import type { SleepType } from '../db/schema';
import { ageInMonths, normForAge, type AgeNorm } from '../norms/ageNorms';
import { DAY, HOUR, MIN, formatDuration, minutesOfDay, sleepInWindow, weightedMedian } from './time';

export interface SleepLike {
  start: number;
  end: number | null;
  type: SleepType;
}

export interface PlannedSleep {
  kind: SleepType;
  /** Most likely start time */
  target: number;
  /** Earliest / latest reasonable start */
  from: number;
  to: number;
  /** Wake window that leads to this sleep, minutes */
  wakeWindowMin: number;
  /** Expected length of a nap, minutes */
  durationMin?: number;
  /** Why the window differs from the child's usual one, if it does */
  note?: string;
}

export interface Warning {
  level: 'info' | 'warn';
  text: string;
}

export type Prediction =
  | { state: 'empty'; norm: AgeNorm; reason: 'noData' | 'stale' }
  | {
      state: 'sleeping';
      norm: AgeNorm;
      kind: SleepType;
      since: number;
      durationMin: number;
      expectedWake: number;
      warnings: Warning[];
    }
  | {
      state: 'awake';
      norm: AgeNorm;
      awakeSince: number;
      awakeMin: number;
      napsToday: number;
      napsPlanned: number;
      /** Expected nap length, minutes */
      napLenMin: number;
      nightWaking: boolean;
      next: PlannedSleep;
      /** Remaining sleeps of the day including the next one; the last item is the night sleep */
      plan: PlannedSleep[];
      warnings: Warning[];
    };

export interface PredictOptions {
  /** Usual morning wake, minutes from midnight */
  dayStartMin?: number;
}

/** History used for personalization; older days barely matter because of the decay below */
const HISTORY_DAYS = 14;
/** A day this old counts half as much as today: children change fast */
const HALF_LIFE_DAYS = 3;
/** A nap at least this long counts as a "successful" one for learning wake windows */
const GOOD_NAP_MIN = 40;
/** Length of a bridging nap when a usual one no longer fits before bedtime */
const CATNAP_MIN = 30;
/** Longer gaps between entries mean missing records, not a real wake window */
const MAX_GAP_MIN = 12 * 60;

/**
 * Starting assumptions, used until the child's own data says otherwise. Pediatric sleep practice:
 * after a short nap the next wake window is shorter, after a long one longer; waking up early in the
 * morning shortens the first window. Both are expressed as a share of the norm window per hour.
 */
const PRIOR_NAP_EFFECT = 0.25;
const PRIOR_EARLY_EFFECT = 0.1;
/** How many days of data it takes to outweigh the prior (pseudo-observations) */
const PRIOR_WEIGHT_RATIO = 3;
const PRIOR_WEIGHT_POSITION = 2;
const PRIOR_WEIGHT_EFFECT = 0.5;

/** Planned wake window for the given position in the day: the first one is the shortest, the last before night the longest. */
export function expectedWakeWindow(norm: AgeNorm, position: number, napsPlanned: number): number {
  const [lo, hi] = norm.wakeWindowMin;
  if (napsPlanned <= 0) return hi;
  const t = Math.min(position / napsPlanned, 1);
  return lo + (hi - lo) * t;
}

export interface WindowSample {
  /** Start of the sleep the window led to */
  at: number;
  /** End of the previous sleep, i.e. when the window began */
  wokeAt: number;
  gapMin: number;
  position: number;
  success: boolean;
  prevType: SleepType;
  prevSleepMin: number;
}

/**
 * Wake windows actually observed: the gap between the end of one sleep and the start of the next.
 * Gaps between two night sleeps are night wakings and are skipped.
 */
export function wakeWindowHistory(sorted: SleepLike[]): WindowSample[] {
  const out: WindowSample[] = [];
  let napsSinceMorning = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    if (prev?.end != null && !(prev.type === 'night' && cur.type === 'night')) {
      const gapMin = (cur.start - prev.end) / MIN;
      if (gapMin > 0 && gapMin < MAX_GAP_MIN) {
        const durMin = cur.end == null ? Infinity : (cur.end - cur.start) / MIN;
        out.push({
          at: cur.start,
          wokeAt: prev.end,
          gapMin,
          position: napsSinceMorning,
          success: cur.type === 'night' || durMin >= GOOD_NAP_MIN,
          prevType: prev.type,
          prevSleepMin: (prev.end - prev.start) / MIN,
        });
      }
    }
    if (cur.type === 'night') napsSinceMorning = 0;
    else napsSinceMorning++;
  }
  return out;
}

/** Naps of every completed day (a day ends when a night sleep starts), with the time it ended. */
function napsPerDay(sorted: SleepLike[]): { at: number; count: number }[] {
  const days: { at: number; count: number }[] = [];
  let n = 0;
  let sawMorning = false;
  for (const s of sorted) {
    if (s.type === 'night') {
      if (sawMorning) days.push({ at: s.start, count: n });
      n = 0;
      sawMorning = s.end != null;
    } else {
      n++;
    }
  }
  return days;
}

/** Morning wakes: ends of night sleeps not followed by another night sleep (those were night wakings). */
function morningWakes(sorted: SleepLike[]): number[] {
  return sorted
    .filter((s, i) => s.type === 'night' && s.end != null && sorted[i + 1]?.type !== 'night')
    .map((s) => s.end!);
}

/** Context of the window being planned, used to adjust it. */
export interface WindowContext {
  /** Length of the nap that just ended, minutes */
  prevNapMin?: number;
  /** Morning wake time, epoch ms (for the first window of the day) */
  wokeAt?: number;
}

export interface Personal {
  napsPlanned: number;
  /** Usual nap length overall, minutes */
  napLenMin: number;
  /** Usual length of the nap at the given position of the day: the last one is often a short catnap */
  napLenAt: (position: number) => number;
  /** Usual morning wake of this child, minutes from midnight, if known */
  usualWakeMin: number | null;
  /** Usual bedtime of this child, minutes from midnight (may exceed 24 h for after-midnight), if known */
  usualBedtimeMin: number | null;
  /** Learned window of this child relative to the norm, for each position of the day */
  ratioByPosition: number[];
  /** Learned effects, share of the norm window per hour */
  napEffect: number;
  earlyEffect: number;
  /** Planned wake window (minutes) before the sleep at the given position of the day */
  wakeWindow: (position: number, ctx?: WindowContext) => { min: number; note?: string };
}

/** Weighted mean pulled towards `prior` as if it were `priorWeight` extra observations. */
function shrunkMean(values: number[], weights: number[], prior: number, priorWeight: number): number {
  let sum = prior * priorWeight;
  let w = priorWeight;
  values.forEach((v, i) => {
    sum += v * weights[i];
    w += weights[i];
  });
  return sum / w;
}

/** Weighted least-squares slope through the origin, pulled towards `prior`. */
function shrunkSlope(xs: number[], ys: number[], weights: number[], prior: number, priorWeight: number): number {
  let xy = prior * priorWeight;
  let xx = priorWeight;
  xs.forEach((x, i) => {
    xy += weights[i] * x * ys[i];
    xx += weights[i] * x * x;
  });
  return xy / xx;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Learns this child's rhythm from recent history. Every window is modelled relative to the age norm:
 *
 *   window / norm window = ratio[position] + napEffect · (previous nap − usual nap, h)
 *                                          − earlyEffect · (how much earlier than usual the child woke, h)
 *
 * Recent days weigh more (half-life of 3 days) and every estimate starts from the norm / prior and
 * moves towards the child's data as it accumulates, so a few odd days cannot throw the forecast off.
 */
export function personalize(sorted: SleepLike[], birthDate: string, now: number): Personal {
  const norm = normForAge(ageInMonths(birthDate, now));
  const recent = sorted.filter((s) => s.start >= now - HISTORY_DAYS * DAY);
  const recency = (at: number) => 0.5 ** ((now - at) / (HALF_LIFE_DAYS * DAY));

  const days = napsPerDay(recent);
  let napsPlanned = norm.naps;
  if (days.length >= 2) {
    const avg = shrunkMean(days.map((d) => d.count), days.map((d) => recency(d.at)), 0, 0);
    napsPlanned = clamp(Math.round(avg), norm.napsRange[0], norm.napsRange[1]);
  }

  const naps: { position: number; len: number; weight: number }[] = [];
  let napsSinceMorning = 0;
  for (const s of recent) {
    if (s.type === 'night') napsSinceMorning = 0;
    else {
      if (s.end != null) naps.push({ position: napsSinceMorning, len: (s.end - s.start) / MIN, weight: recency(s.start) });
      napsSinceMorning++;
    }
  }
  const typicalNap = (list: typeof naps, fallback: number) =>
    list.length >= 3 ? clamp(weightedMedian(list.map((n) => n.len), list.map((n) => n.weight)), 20, norm.maxNapMin) : fallback;
  const napLenMin = typicalNap(naps, norm.typicalNapMin);
  const napLenByPosition = Array.from({ length: napsPlanned }, (_, pos) =>
    typicalNap(naps.filter((n) => n.position === pos), napLenMin),
  );
  const napLenAt = (position: number) => napLenByPosition[position] ?? napLenMin;

  const wakes = morningWakes(recent);
  const usualWakeMin = wakes.length >= 3 ? weightedMedian(wakes.map(minutesOfDay), wakes.map(recency)) : null;
  const earliness = (wokeAt: number) =>
    usualWakeMin == null ? 0 : clamp((usualWakeMin - minutesOfDay(wokeAt)) / 60, -2, 3);

  const nights = recent.filter((s, i) => s.type === 'night' && recent[i - 1]?.type !== 'night');
  // Bedtimes after midnight continue the evening: 00:30 is 24:30, not 0:30.
  const bedtimeOf = (ts: number) => {
    const m = minutesOfDay(ts);
    return m < 12 * 60 ? m + 24 * 60 : m;
  };
  const usualBedtimeMin =
    nights.length >= 3 ? weightedMedian(nights.map((s) => bedtimeOf(s.start)), nights.map((s) => recency(s.start))) : null;

  const samples = wakeWindowHistory(recent)
    .filter((w) => w.success)
    .map((w) => {
      // Compare with the norm for the age the child had then, so growing up does not look like a habit.
      const normThen = normForAge(ageInMonths(birthDate, w.at));
      const position = Math.min(w.position, napsPlanned);
      return {
        position,
        ratio: w.gapMin / expectedWakeWindow(normThen, position, napsPlanned),
        weight: recency(w.at),
        xNap: w.prevType === 'nap' ? (w.prevSleepMin - napLenMin) / 60 : 0,
        xEarly: w.prevType === 'night' ? earliness(w.wokeAt) : 0,
      };
    });

  // Alternate between the per-position level and the two effects; a few rounds are enough to settle.
  let napEffect = PRIOR_NAP_EFFECT;
  let earlyEffect = PRIOR_EARLY_EFFECT;
  let ratioByPosition: number[] = [];
  const level = (s: (typeof samples)[number]) => ratioByPosition[s.position];
  for (let round = 0; round < 4; round++) {
    const cleaned = samples.map((s) => s.ratio - napEffect * s.xNap + earlyEffect * s.xEarly);
    const overall = clamp(
      shrunkMean(cleaned, samples.map((s) => s.weight), 1, PRIOR_WEIGHT_RATIO),
      0.7,
      1.3,
    );
    ratioByPosition = Array.from({ length: napsPlanned + 1 }, (_, pos) => {
      const idx = samples.flatMap((s, i) => (s.position === pos ? [i] : []));
      return clamp(
        shrunkMean(idx.map((i) => cleaned[i]), idx.map((i) => samples[i].weight), overall, PRIOR_WEIGHT_POSITION),
        0.7,
        1.3,
      );
    });

    const afterNap = samples.filter((s) => s.xNap !== 0);
    napEffect = clamp(
      shrunkSlope(
        afterNap.map((s) => s.xNap),
        afterNap.map((s) => s.ratio - level(s) + earlyEffect * s.xEarly),
        afterNap.map((s) => s.weight),
        PRIOR_NAP_EFFECT,
        PRIOR_WEIGHT_EFFECT,
      ),
      0,
      0.6,
    );

    const mornings = samples.filter((s) => s.xEarly !== 0);
    earlyEffect = clamp(
      shrunkSlope(
        mornings.map((s) => s.xEarly),
        mornings.map((s) => level(s) + napEffect * s.xNap - s.ratio),
        mornings.map((s) => s.weight),
        PRIOR_EARLY_EFFECT,
        PRIOR_WEIGHT_EFFECT,
      ),
      0,
      0.3,
    );
  }

  const [lo, hi] = norm.wakeWindowMin;
  const wakeWindow = (position: number, ctx: WindowContext = {}) => {
    const pos = Math.min(position, napsPlanned);
    const normWw = expectedWakeWindow(norm, pos, napsPlanned);
    const usual = normWw * ratioByPosition[pos];
    let adjust = 0;
    let note: string | undefined;
    if (ctx.prevNapMin != null) {
      adjust = (normWw * napEffect * (ctx.prevNapMin - napLenMin)) / 60;
      if (Math.abs(adjust) >= 5) {
        note = ctx.prevNapMin < napLenMin
          ? `Сон был короче обычного (${formatDuration(ctx.prevNapMin)}) — окно короче на ${formatDuration(-adjust)}`
          : `Сон был длиннее обычного (${formatDuration(ctx.prevNapMin)}) — окно длиннее на ${formatDuration(adjust)}`;
      }
    } else if (ctx.wokeAt != null && pos === 0) {
      const early = earliness(ctx.wokeAt);
      adjust = -normWw * earlyEffect * early;
      if (adjust <= -5) note = `Ранний подъём — первое окно короче на ${formatDuration(-adjust)}`;
    }
    const min = clamp(usual + adjust, lo * 0.75, hi * 1.25);
    return { min, note };
  };

  return {
    napsPlanned, napLenMin, napLenAt, usualWakeMin, usualBedtimeMin, ratioByPosition, napEffect, earlyEffect, wakeWindow,
  };
}

function plannedSleep(kind: SleepType, after: number, wwMin: number, note?: string, durationMin?: number): PlannedSleep {
  const spread = Math.min(Math.max(wwMin * 0.1, 10), 20) * MIN;
  const target = after + wwMin * MIN;
  return { kind, target, from: target - spread, to: target + spread, wakeWindowMin: Math.round(wwMin), durationMin, note };
}

/** Next morning wake after a night sleep that began at `start`. */
function nextMorning(start: number, dayStartMin: number): number {
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(dayStartMin);
  if (d.getTime() <= start + 4 * HOUR) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function predict(
  entries: SleepLike[],
  birthDate: string,
  now: number,
  { dayStartMin = 7 * 60 }: PredictOptions = {},
): Prediction {
  const norm = normForAge(ageInMonths(birthDate, now));
  const sorted = entries.filter((e) => e.start <= now).sort((a, b) => a.start - b.start);
  const last = sorted[sorted.length - 1];
  if (!last) return { state: 'empty', norm, reason: 'noData' };

  const personal = personalize(sorted, birthDate, now);
  const warnings: Warning[] = [];

  if (last.end == null) {
    const durationMin = (now - last.start) / MIN;
    if (last.type === 'nap') {
      if (durationMin > norm.maxNapMin) {
        warnings.push({
          level: 'warn',
          text: `Дневной сон длится дольше ${formatDuration(norm.maxNapMin)} — стоит разбудить, чтобы не сбить ночной сон.`,
        });
      }
      let napsBefore = 0;
      for (let i = sorted.length - 2; i >= 0 && sorted[i].type === 'nap'; i--) napsBefore++;
      return {
        state: 'sleeping', norm, kind: 'nap', since: last.start, durationMin, warnings,
        expectedWake: last.start + personal.napLenAt(napsBefore) * MIN,
      };
    }
    return {
      state: 'sleeping', norm, kind: 'night', since: last.start, durationMin, warnings,
      expectedWake: nextMorning(last.start, dayStartMin),
    };
  }

  const awakeSince = last.end;
  const awakeMin = (now - awakeSince) / MIN;
  if (awakeMin > 18 * 60) return { state: 'empty', norm, reason: 'stale' };

  // Naps already taken since the last night sleep.
  let napsToday = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].type === 'nap'; i--) napsToday++;

  const wakeMinOfDay = minutesOfDay(awakeSince);
  const nightWaking =
    last.type === 'night' && (wakeMinOfDay < dayStartMin - 90 || wakeMinOfDay >= norm.bedtime[1] + 60);

  const plan: PlannedSleep[] = [];
  if (nightWaking) {
    // Woke up in the middle of the night: the next sleep is still the night one.
    plan.push(plannedSleep('night', awakeSince, Math.min(norm.wakeWindowMin[0], 60)));
  } else {
    let t = awakeSince;
    let pos = napsToday;
    // The window that has already started knows what came before it; later ones follow the planned naps.
    let ctx: WindowContext =
      last.type === 'nap' ? { prevNapMin: (last.end - last.start) / MIN } : { wokeAt: last.end };
    for (let guard = 0; guard < 10; guard++) {
      const { min: ww, note } = personal.wakeWindow(pos, ctx);
      if (pos >= personal.napsPlanned) {
        plan.push(plannedSleep('night', t, ww, note));
        break;
      }
      // Latest reasonable bedtime: the norm, or later if this child usually goes to bed later.
      const bedtimeLimit = dayAt(t, Math.max(norm.bedtime[1], personal.usualBedtimeMin ?? 0) + 30);
      const fits = (len: number) =>
        t + (ww + len + personal.wakeWindow(pos + 1, { prevNapMin: len }).min) * MIN <= bedtimeLimit;
      let napLen = personal.napLenAt(pos);
      let napNote = note;
      if (!fits(napLen) && napLen > CATNAP_MIN && fits(CATNAP_MIN)) {
        // A usual nap no longer fits before bedtime (the day started late): a short one bridges to night.
        napLen = CATNAP_MIN;
        napNote = [note, 'Короткий сон, чтобы дотянуть до ночи'].filter(Boolean).join('. ');
      } else if (!fits(napLen) && pos >= norm.napsRange[0]) {
        // Not even a short nap fits: go to bed earlier, without stretching the window too far.
        const longest = Math.max(ww, personal.wakeWindow(personal.napsPlanned, ctx).min * 1.15);
        const toEarliestBedtime = (dayAt(t, norm.bedtime[0]) - t) / MIN;
        plan.push(plannedSleep('night', t, clamp(toEarliestBedtime, ww, longest), note));
        break;
      }
      plan.push(plannedSleep('nap', t, ww, napNote, napLen));
      ctx = { prevNapMin: napLen };
      t += (ww + napLen) * MIN;
      pos++;
    }
  }

  const next = plan[0];
  if (!nightWaking && awakeMin > next.wakeWindowMin * 1.15 && now > next.to) {
    warnings.push({
      level: 'warn',
      text: 'Малыш бодрствует дольше рекомендованного окна — возможна переутомлённость. Попробуйте уложить сейчас.',
    });
  }

  const earliest = sorted[0].start;
  if (earliest <= now - 24 * HOUR) {
    const slept = sleepInWindow(sorted, now - 24 * HOUR, now, now) / HOUR;
    if (slept < norm.totalSleepH[0]) {
      warnings.push({
        level: 'info',
        text: `За последние 24 часа малыш спал ${slept.toFixed(1)} ч — меньше рекомендованных ${norm.totalSleepH[0]}–${norm.totalSleepH[1]} ч.`,
      });
    }
  }

  return {
    state: 'awake', norm, awakeSince, awakeMin, napsToday, napsPlanned: personal.napsPlanned,
    napLenMin: personal.napLenMin, nightWaking, next, plan, warnings,
  };
}

/** Epoch ms of the given minutes-of-day on the same calendar day as `ref`. */
function dayAt(ref: number, minutesOfDayValue: number): number {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutesOfDayValue);
  return d.getTime();
}
