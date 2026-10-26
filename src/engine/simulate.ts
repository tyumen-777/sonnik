import type { SleepLike } from './predict';
import { expectedWakeWindow } from './predict';
import { ageInMonths, normForAge } from '../norms/ageNorms';
import { MIN, addDays } from './time';

/**
 * A simulated child with known habits, for evaluating the forecast: the generated log follows the
 * rules below plus random noise, so we can check how well the model recovers them.
 */
export interface SimChild {
  birthDate: string;
  /** Wake windows of this child relative to the age norm, e.g. 1.15 = 15% longer */
  windowRatio: number;
  /** Ratio change of the next window per hour of nap above / below the typical length */
  napEffect: number;
  /** Ratio change of the first window per hour of waking earlier than usual */
  earlyEffect: number;
  /** Usual morning wake, minutes from midnight */
  usualWakeMin: number;
  /** Random variation of wake windows, minutes (standard deviation) */
  noiseMin: number;
  /** Share of naps that are short (30–40 min) */
  shortNapShare: number;
  seed: number;
}

export const DEFAULT_CHILD: SimChild = {
  birthDate: '2025-09-01',
  windowRatio: 1,
  napEffect: 0.3,
  earlyEffect: 0.1,
  usualWakeMin: 6 * 60 + 45,
  noiseMin: 12,
  shortNapShare: 0.25,
  seed: 1,
};

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, normal };
}

/** Generates `days` days of sleep log starting with the morning of `firstDay` (local midnight). */
export function simulate(child: SimChild, firstDay: number, days: number): SleepLike[] {
  const r = rng(child.seed);
  const out: SleepLike[] = [];
  let nightStart: number | null = null;

  for (let d = 0; d < days; d++) {
    const midnight = addDays(firstDay, d);
    const earlyHours = r.next() < 0.12 ? 0.75 + r.next() : 0;
    const wake = midnight + (child.usualWakeMin + r.normal() * 15 - earlyHours * 60) * MIN;
    if (nightStart != null) out.push({ start: nightStart, end: wake, type: 'night' });

    const norm = normForAge(ageInMonths(child.birthDate, wake));
    let t = wake;
    let prevNap: number | null = null;
    for (let pos = 0; pos <= norm.naps; pos++) {
      let ratio = child.windowRatio;
      if (pos === 0) ratio -= child.earlyEffect * earlyHours;
      else ratio += (child.napEffect * (prevNap! - norm.typicalNapMin)) / 60;
      const ww = expectedWakeWindow(norm, pos, norm.naps) * ratio + r.normal() * child.noiseMin;
      const start = t + Math.max(ww, 30) * MIN;
      if (pos === norm.naps) {
        nightStart = start;
        break;
      }
      const napLen =
        r.next() < child.shortNapShare ? 30 + r.next() * 10 : Math.max(45, norm.typicalNapMin + r.normal() * 15);
      out.push({ start, end: start + napLen * MIN, type: 'nap' });
      t = start + napLen * MIN;
      prevNap = napLen;
    }
  }
  return out;
}
