import { describe, expect, it } from 'vitest';
import { expectedWakeWindow, personalize, predict, type SleepLike } from './predict';
import { backtest } from './backtest';
import { DEFAULT_CHILD, simulate } from './simulate';
import { dailyStats, daySegments, summarize } from './stats';
import { normForAge } from '../norms/ageNorms';
import { HOUR, MIN } from './time';

/** Local time on a fixed date: at(1, 7, 30) = day 1, 07:30. */
const at = (day: number, h: number, m = 0) => new Date(2026, 2, day, h, m).getTime();
/** Child born on 2025-09-01 is ~6 months old in March 2026. */
const BIRTH_6M = '2025-09-01';

const nap = (start: number, end: number | null): SleepLike => ({ start, end, type: 'nap' });
const night = (start: number, end: number | null): SleepLike => ({ start, end, type: 'night' });

describe('norms', () => {
  it('picks the row by age', () => {
    expect(normForAge(0.5).label).toBe('0–1 мес');
    expect(normForAge(6.2).label).toBe('6–8 мес');
    expect(normForAge(20).naps).toBe(1);
    expect(normForAge(200).label).toBe('3–5 лет');
  });

  it('wake windows grow through the day', () => {
    const n = normForAge(6.5);
    expect(expectedWakeWindow(n, 0, 3)).toBe(n.wakeWindowMin[0]);
    expect(expectedWakeWindow(n, 3, 3)).toBe(n.wakeWindowMin[1]);
    expect(expectedWakeWindow(n, 1, 3)).toBeGreaterThan(n.wakeWindowMin[0]);
  });
});

describe('predict', () => {
  it('returns empty without data', () => {
    expect(predict([], BIRTH_6M, at(10, 9)).state).toBe('empty');
  });

  it('plans the first nap after the morning wake from the norm', () => {
    const p = predict([night(at(9, 19, 30), at(10, 7))], BIRTH_6M, at(10, 8));
    expect(p.state).toBe('awake');
    if (p.state !== 'awake') return;
    expect(p.napsToday).toBe(0);
    expect(p.next.kind).toBe('nap');
    // 6–8 months: first wake window is 2 h.
    expect(p.next.target).toBe(at(10, 9));
    expect(p.plan[p.plan.length - 1].kind).toBe('night');
    expect(p.plan.filter((s) => s.kind === 'nap')).toHaveLength(3);
  });

  it('plans night sleep once all naps are done', () => {
    const entries = [
      night(at(9, 19, 30), at(10, 7)),
      nap(at(10, 9), at(10, 10)),
      nap(at(10, 12, 30), at(10, 13, 30)),
      nap(at(10, 16), at(10, 16, 40)),
    ];
    const p = predict(entries, BIRTH_6M, at(10, 17));
    expect(p.state).toBe('awake');
    if (p.state !== 'awake') return;
    expect(p.napsToday).toBe(3);
    expect(p.next.kind).toBe('night');
    expect(p.plan).toHaveLength(1);
  });

  it('reports a running sleep and warns about a too long nap', () => {
    const entries = [night(at(9, 19, 30), at(10, 7)), nap(at(10, 9), null)];
    const short = predict(entries, BIRTH_6M, at(10, 9, 30));
    expect(short.state).toBe('sleeping');
    if (short.state === 'sleeping') {
      expect(short.kind).toBe('nap');
      expect(short.durationMin).toBe(30);
      expect(short.warnings).toHaveLength(0);
    }
    const long = predict(entries, BIRTH_6M, at(10, 11, 30));
    expect(long.state === 'sleeping' && long.warnings.length).toBe(1);
  });

  it('expects the morning after a night sleep crossing midnight', () => {
    const p = predict([night(at(9, 20), null)], BIRTH_6M, at(10, 2));
    expect(p.state).toBe('sleeping');
    if (p.state === 'sleeping') expect(p.expectedWake).toBe(at(10, 7));
  });

  it('treats waking at 3 am as a night waking', () => {
    const p = predict([night(at(9, 20), at(10, 3))], BIRTH_6M, at(10, 3, 10));
    expect(p.state === 'awake' && p.nightWaking).toBe(true);
    if (p.state === 'awake') expect(p.next.kind).toBe('night');
  });

  it('learns the child\'s own wake windows from history', () => {
    const entries: SleepLike[] = [];
    for (let d = 1; d <= 7; d++) {
      // Every first wake window is 2.5 h instead of the 2 h norm.
      entries.push(night(at(d - 1, 19, 30), at(d, 7)));
      entries.push(nap(at(d, 9, 30), at(d, 10, 30)));
      entries.push(nap(at(d, 13, 30), at(d, 14, 30)));
      entries.push(nap(at(d, 17), at(d, 17, 30)));
    }
    entries.push(night(at(7, 20), at(8, 7)));
    const p = predict(entries, BIRTH_6M, at(8, 7, 30));
    expect(p.state).toBe('awake');
    if (p.state !== 'awake') return;
    const plannedMin = (p.next.target - at(8, 7)) / MIN;
    // Norm says 2 h, this child's first window is consistently 2.5 h.
    expect(plannedMin).toBeGreaterThan(135);
    expect(plannedMin).toBeLessThanOrEqual(150);
    // The window before night is learned separately: 17:30 → 20:00 = 2.5 h, not the 3 h norm.
    const bedtime = p.plan[p.plan.length - 1];
    expect(bedtime.wakeWindowMin).toBeLessThan(165);
    // Three naps a day in history, so three are planned even with longer windows.
    expect(p.plan.filter((s) => s.kind === 'nap')).toHaveLength(3);
  });

  it('skips the last nap when it would push bedtime too late', () => {
    const entries = [night(at(9, 19, 30), at(10, 7)), nap(at(10, 9), at(10, 10)), nap(at(10, 15), at(10, 17))];
    const p = predict(entries, BIRTH_6M, at(10, 17, 30));
    expect(p.state === 'awake' && p.next.kind).toBe('night');
  });

  it('warns when awake far too long', () => {
    const p = predict([night(at(9, 19, 30), at(10, 7))], BIRTH_6M, at(10, 10, 30));
    expect(p.state === 'awake' && p.warnings.some((w) => w.level === 'warn')).toBe(true);
  });

  it('returns stale state after a long gap in records', () => {
    expect(predict([night(at(8, 20), at(9, 7))], BIRTH_6M, at(10, 9)).state).toBe('empty');
  });
});

describe('learning', () => {
  const firstDay = new Date(2026, 4, 1).getTime();
  const DAY_MS = 24 * HOUR;

  it('recovers the habits of a simulated child', () => {
    const child = { ...DEFAULT_CHILD, windowRatio: 1.15, napEffect: 0.35, seed: 7 };
    const log = simulate(child, firstDay, 21);
    const p = personalize(log, child.birthDate, firstDay + 21 * DAY_MS);
    expect(p.napEffect).toBeGreaterThan(0.2);
    expect(p.napEffect).toBeLessThan(0.5);
    for (const r of p.ratioByPosition.slice(1)) expect(r).toBeCloseTo(1.15, 0);
  });

  it('keeps forecast error close to the natural variation', () => {
    for (const seed of [1, 2, 3]) {
      const child = { ...DEFAULT_CHILD, seed };
      const r = backtest(simulate(child, firstDay, 21), child.birthDate, { since: firstDay + 7 * DAY_MS });
      expect(r.n).toBeGreaterThan(30);
      // Wake windows vary by ±12 min in the simulation, so ~10 min is the floor.
      expect(r.maeMin).toBeLessThan(14);
      expect(r.hitRate).toBeGreaterThan(0.65);
      expect(Math.abs(r.biasMin)).toBeLessThan(5);
    }
  });

  it('shortens the next window after a short nap and explains why', () => {
    const entries: SleepLike[] = [];
    for (let d = 1; d <= 5; d++) {
      entries.push(night(at(d - 1, 19, 30), at(d, 7)));
      entries.push(nap(at(d, 9), at(d, 10)));
      entries.push(nap(at(d, 12, 30), at(d, 13, 30)));
      entries.push(nap(at(d, 16), at(d, 16, 45)));
    }
    entries.push(night(at(5, 19, 30), at(6, 7)));
    const usual = predict([...entries, nap(at(6, 9), at(6, 10))], BIRTH_6M, at(6, 10, 5));
    const short = predict([...entries, nap(at(6, 9), at(6, 9, 30))], BIRTH_6M, at(6, 9, 35));
    if (usual.state !== 'awake' || short.state !== 'awake') throw new Error('expected awake');
    expect(short.next.wakeWindowMin).toBeLessThan(usual.next.wakeWindowMin - 5);
    expect(short.next.note).toMatch(/короче/);
    expect(usual.next.note).toBeUndefined();
  });

  it('plans a short last nap when the child usually has a catnap', () => {
    const entries: SleepLike[] = [];
    for (let d = 1; d <= 5; d++) {
      entries.push(night(at(d - 1, 19, 30), at(d, 7)));
      entries.push(nap(at(d, 9), at(d, 10, 15)));
      entries.push(nap(at(d, 12, 45), at(d, 14)));
      entries.push(nap(at(d, 16, 30), at(d, 17)));
    }
    entries.push(night(at(5, 19, 30), at(6, 7)));
    const p = predict(entries, BIRTH_6M, at(6, 7, 10));
    if (p.state !== 'awake') throw new Error('expected awake');
    const naps = p.plan.filter((s) => s.kind === 'nap');
    expect(naps).toHaveLength(3);
    expect(naps[2].durationMin).toBe(30);
    expect(naps[0].durationMin).toBe(75);
  });

  it('keeps the last nap for a child who usually goes to bed late', () => {
    const entries: SleepLike[] = [];
    for (let d = 1; d <= 5; d++) {
      entries.push(night(at(d - 1, 20, 50), at(d, 7)));
      entries.push(nap(at(d, 9, 30), at(d, 10, 30)));
      entries.push(nap(at(d, 13, 30), at(d, 14, 30)));
      entries.push(nap(at(d, 17, 30), at(d, 18)));
    }
    entries.push(night(at(5, 20, 50), at(6, 7)));
    const p = predict(entries, BIRTH_6M, at(6, 7, 10));
    if (p.state !== 'awake') throw new Error('expected awake');
    expect(p.plan.filter((s) => s.kind === 'nap')).toHaveLength(3);
  });

  it('bridges a late day with a short nap instead of a too long window', () => {
    // Usual day: naps at 9:30, 13:00, 16:30, bedtime 19:30. Today the first nap was late.
    const entries: SleepLike[] = [];
    for (let d = 1; d <= 5; d++) {
      entries.push(night(at(d - 1, 19, 30), at(d, 7)));
      entries.push(nap(at(d, 9, 15), at(d, 10, 15)));
      entries.push(nap(at(d, 12, 45), at(d, 13, 45)));
      entries.push(nap(at(d, 16, 30), at(d, 17, 15)));
    }
    entries.push(night(at(5, 19, 30), at(6, 7)), nap(at(6, 10), at(6, 11)), nap(at(6, 14), at(6, 15)));
    const p = predict(entries, BIRTH_6M, at(6, 15, 5));
    if (p.state !== 'awake') throw new Error('expected awake');
    expect(p.next.kind).toBe('nap');
    expect(p.next.durationMin).toBe(30);
    expect(p.next.note).toMatch(/дотянуть/);
    const bedtime = p.plan[p.plan.length - 1];
    expect(bedtime.target).toBeLessThanOrEqual(at(6, 21));
  });
});

describe('backtest', () => {
  it('scores each sleep against the forecast made when the child woke up', () => {
    const entries = [
      night(at(9, 19, 30), at(10, 7)),
      nap(at(10, 9), at(10, 10)),
      nap(at(10, 12, 30), at(10, 13, 30)),
    ];
    const r = backtest(entries, BIRTH_6M);
    expect(r.n).toBe(2);
    // No history yet, so the first forecast is the norm: 7:00 + 2 h = 9:00, exactly right.
    expect(r.cases[0].errorMin).toBe(0);
    expect(r.cases[0].inWindow).toBe(true);
  });
});

describe('stats', () => {
  it('splits sleep across midnight and counts naps', () => {
    const entries = [
      night(at(9, 20), at(10, 7)),
      nap(at(10, 9), at(10, 10, 30)),
      nap(at(10, 13), at(10, 14)),
      night(at(10, 19), at(11, 6)),
    ];
    const [d9, d10] = dailyStats(entries, at(9, 0), 2, at(11, 12));
    expect(d9.nightMin).toBe(4 * 60);
    expect(d10.nightMin).toBe(7 * 60 + 5 * 60);
    expect(d10.napMin).toBe(150);
    expect(d10.naps).toBe(2);
    expect(d10.avgWakeWindowMin).toBe((120 + 150 + 300) / 3);

    const s = summarize([d9, d10]);
    expect(s?.days).toBe(2);
  });

  it('builds day segments including a running sleep', () => {
    const segs = daySegments([night(at(9, 20), at(10, 6)), nap(at(10, 12), null)], at(10, 0), at(10, 13));
    expect(segs).toHaveLength(2);
    expect(segs[0].from).toBe(0);
    expect(segs[0].to).toBeCloseTo(6 / 24);
    expect(segs[1].running).toBe(true);
    expect(segs[1].to - segs[1].from).toBeCloseTo(HOUR / (24 * HOUR));
  });
});
