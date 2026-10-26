import type { SleepLike } from './predict';
import { wakeWindowHistory } from './predict';
import { MIN, addDays, sleepInWindow, startOfDay } from './time';

export interface DayStats {
  /** Midnight of the day, epoch ms */
  day: number;
  napMin: number;
  nightMin: number;
  totalMin: number;
  naps: number;
  avgWakeWindowMin: number | null;
}

export interface Segment {
  type: SleepLike['type'];
  /** Fractions of the day, 0..1 */
  from: number;
  to: number;
  running: boolean;
}

/** Sleep of every calendar day in [firstDay, firstDay + days), with sleep crossing midnight split between days. */
export function dailyStats(entries: SleepLike[], firstDay: number, days: number, now: number): DayStats[] {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  const windows = wakeWindowHistory(sorted);
  const out: DayStats[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(firstDay), i);
    const next = addDays(day, 1);
    const napMin = sleepInWindow(sorted.filter((e) => e.type === 'nap'), day, next, now) / MIN;
    const nightMin = sleepInWindow(sorted.filter((e) => e.type === 'night'), day, next, now) / MIN;
    const dayWindows = windows.filter((w) => w.at >= day && w.at < next).map((w) => w.gapMin);
    out.push({
      day,
      napMin,
      nightMin,
      totalMin: napMin + nightMin,
      naps: sorted.filter((e) => e.type === 'nap' && e.start >= day && e.start < next).length,
      avgWakeWindowMin: dayWindows.length ? dayWindows.reduce((a, b) => a + b, 0) / dayWindows.length : null,
    });
  }
  return out;
}

/** Sleep segments of one calendar day as fractions of that day, for timeline rendering. */
export function daySegments(entries: SleepLike[], day: number, now: number): Segment[] {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  const len = to - from;
  const out: Segment[] = [];
  for (const e of entries) {
    const end = e.end ?? now;
    const s = Math.max(e.start, from);
    const t = Math.min(end, to);
    if (t > s) out.push({ type: e.type, from: (s - from) / len, to: (t - from) / len, running: e.end == null });
  }
  return out.sort((a, b) => a.from - b.from);
}

export interface Summary {
  days: number;
  avgTotalMin: number;
  avgNightMin: number;
  avgNapMin: number;
  avgNaps: number;
  avgWakeWindowMin: number | null;
}

/** Averages over days that have any sleep recorded. */
export function summarize(stats: DayStats[]): Summary | null {
  const withData = stats.filter((d) => d.totalMin > 0);
  if (!withData.length) return null;
  const avg = (f: (d: DayStats) => number) => withData.reduce((a, d) => a + f(d), 0) / withData.length;
  const ww = withData.filter((d) => d.avgWakeWindowMin != null);
  return {
    days: withData.length,
    avgTotalMin: avg((d) => d.totalMin),
    avgNightMin: avg((d) => d.nightMin),
    avgNapMin: avg((d) => d.napMin),
    avgNaps: avg((d) => d.naps),
    avgWakeWindowMin: ww.length ? ww.reduce((a, d) => a + d.avgWakeWindowMin!, 0) / ww.length : null,
  };
}
