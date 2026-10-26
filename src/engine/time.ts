export const MIN = 60_000;
export const HOUR = 60 * MIN;

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar-aware day shift, safe across DST changes. */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Total sleep (ms) of entries overlapping [from, to); a sleep still running counts until `now`. */
export function sleepInWindow(
  entries: { start: number; end: number | null }[],
  from: number,
  to: number,
  now: number,
): number {
  let total = 0;
  for (const e of entries) {
    const s = Math.max(e.start, from);
    const t = Math.min(e.end ?? now, to);
    if (t > s) total += t - s;
  }
  return total;
}

export function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export const DAY = 24 * HOUR;

/** Median where each value counts in proportion to its weight. */
export function weightedMedian(values: number[], weights: number[]): number {
  const order = values.map((v, i) => [v, weights[i]] as const).sort((a, b) => a[0] - b[0]);
  const half = weights.reduce((a, b) => a + b, 0) / 2;
  let acc = 0;
  for (const [v, w] of order) {
    acc += w;
    if (acc >= half) return v;
  }
  return order[order.length - 1][0];
}
