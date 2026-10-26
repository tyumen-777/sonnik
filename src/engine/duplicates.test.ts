import { describe, expect, it } from 'vitest';
import { findDuplicateSleeps } from './duplicates';

const at = (h: number, m = 0) => new Date(2026, 2, 10, h, m).getTime();
const sleep = (id: string, start: number, end: number | null) => ({ id, start, end });

describe('findDuplicateSleeps', () => {
  it('keeps the earliest of two running sleeps', () => {
    const dups = findDuplicateSleeps([sleep('b', at(13, 5), null), sleep('a', at(13), null)]);
    expect(dups.map((s) => s.id)).toEqual(['b']);
  });

  it('drops a running sleep that started inside one already finished', () => {
    // Parent A recorded 13:00–14:00, parent B pressed "Уснул" at 13:05 offline and never stopped it.
    const dups = findDuplicateSleeps([sleep('a', at(13), at(14)), sleep('b', at(13, 5), null)]);
    expect(dups.map((s) => s.id)).toEqual(['b']);
  });

  it('keeps a running sleep that started after the previous one ended', () => {
    expect(findDuplicateSleeps([sleep('a', at(9), at(10)), sleep('b', at(12), null)])).toEqual([]);
  });

  it('never removes finished sleeps, even overlapping ones', () => {
    expect(findDuplicateSleeps([sleep('a', at(13), at(14)), sleep('b', at(13, 30), at(14, 30))])).toEqual([]);
  });

  it('is deterministic for identical start times on both devices', () => {
    const x = findDuplicateSleeps([sleep('slp2', at(13), null), sleep('slp1', at(13), null)]);
    const y = findDuplicateSleeps([sleep('slp1', at(13), null), sleep('slp2', at(13), null)]);
    expect(x.map((s) => s.id)).toEqual(['slp2']);
    expect(y.map((s) => s.id)).toEqual(['slp2']);
  });
});
