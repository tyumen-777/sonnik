import type { SleepLike, PlannedSleep } from '../engine/predict';
import { daySegments } from '../engine/stats';
import { addDays, startOfDay } from '../engine/time';

interface Props {
  entries: SleepLike[];
  day: number;
  now: number;
  planned?: PlannedSleep[];
  /** Typical nap length used to draw planned naps, minutes */
  plannedNapMin?: number;
  compact?: boolean;
}

/** A 24-hour strip of the day: sleep segments, planned sleeps and the current time. */
export default function DayTimeline({ entries, day, now, planned = [], plannedNapMin = 60, compact }: Props) {
  const from = startOfDay(day);
  const len = addDays(from, 1) - from;
  const pos = (ts: number) => Math.min(Math.max((ts - from) / len, 0), 1) * 100;
  const segs = daySegments(entries, from, now);
  const showNow = now >= from && now < from + len;

  return (
    <div>
      <div className={`relative overflow-hidden rounded-lg border border-line bg-surface-2 ${compact ? 'h-4' : 'h-10'}`}>
        {planned.map((p, i) => {
          const end = p.kind === 'night' ? from + len : p.target + (p.durationMin ?? plannedNapMin) * 60000;
          if (p.target >= from + len) return null;
          return (
            <div
              key={i}
              className={`absolute inset-y-1 rounded-md border-2 border-dashed ${p.kind === 'nap' ? 'border-nap' : 'border-night'}`}
              style={{ left: `${pos(p.target)}%`, width: `${Math.max(pos(end) - pos(p.target), 0.8)}%` }}
            />
          );
        })}
        {segs.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-y-0 ${s.type === 'nap' ? 'bg-nap' : 'bg-night'} ${s.running ? 'animate-pulse' : ''}`}
            style={{ left: `${s.from * 100}%`, width: `${Math.max((s.to - s.from) * 100, 0.4)}%` }}
          />
        ))}
        {showNow && <div className="absolute -inset-y-px w-0.5 bg-fg" style={{ left: `${pos(now)}%` }} />}
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-xs text-fg-muted tabular-nums">
          {['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}</span>)}
        </div>
      )}
    </div>
  );
}
