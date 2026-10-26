import type { PredictOptions, Prediction, SleepLike } from './predict';
import { predict } from './predict';
import { MIN, median } from './time';

export type Predictor = (entries: SleepLike[], birthDate: string, now: number, opts?: PredictOptions) => Prediction;

export interface BacktestCase {
  /** When the forecast was made: the moment the child woke up */
  at: number;
  kind: SleepLike['type'];
  target: number;
  actual: number;
  /** actual − predicted, minutes: positive means the child fell asleep later than predicted */
  errorMin: number;
  inWindow: boolean;
}

export interface BacktestResult {
  cases: BacktestCase[];
  n: number;
  /** Mean absolute error, minutes */
  maeMin: number;
  medianAbsErrorMin: number;
  /** Share of sleeps that started inside the predicted from–to window */
  hitRate: number;
  /** Mean signed error, minutes: systematic early (<0) or late (>0) forecasts */
  biasMin: number;
}

export interface BacktestOptions extends PredictOptions {
  /** Only score sleeps that started at or after this moment (older ones still serve as history) */
  since?: number;
  predictor?: Predictor;
}

/**
 * Replays the log: for every recorded sleep, asks what the forecast would have said at the moment the
 * child woke up before it, using only the data known then, and compares it with what actually happened.
 */
export function backtest(entries: SleepLike[], birthDate: string, opts: BacktestOptions = {}): BacktestResult {
  const { since = -Infinity, predictor = predict, ...predictOpts } = opts;
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  const cases: BacktestCase[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.start < since || prev.end == null || cur.start <= prev.end) continue;
    // Falling back asleep after a night waking is not a scheduled sleep.
    if (prev.type === 'night' && cur.type === 'night') continue;

    const p = predictor(sorted.slice(0, i), birthDate, prev.end, predictOpts);
    if (p.state !== 'awake' || p.nightWaking) continue;

    const { target, from, to } = p.next;
    cases.push({
      at: prev.end,
      kind: cur.type,
      target,
      actual: cur.start,
      errorMin: (cur.start - target) / MIN,
      inWindow: cur.start >= from && cur.start <= to,
    });
  }

  const n = cases.length;
  const abs = cases.map((c) => Math.abs(c.errorMin));
  return {
    cases,
    n,
    maeMin: n ? abs.reduce((a, b) => a + b, 0) / n : 0,
    medianAbsErrorMin: n ? median(abs) : 0,
    hitRate: n ? cases.filter((c) => c.inWindow).length / n : 0,
    biasMin: n ? cases.reduce((a, c) => a + c.errorMin, 0) / n : 0,
  };
}
