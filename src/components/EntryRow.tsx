import type { SleepEntry } from '../db/schema';
import { fmtTime, formatDuration } from '../lib/format';
import { TYPE_LABEL } from './TypeToggle';

export default function EntryRow({ entry, now, onClick }: { entry: SleepEntry; now: number; onClick: () => void }) {
  const end = entry.end ?? now;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-surface-2/60">
      <span className={`h-9 w-1.5 shrink-0 rounded-full ${entry.type === 'nap' ? 'bg-nap' : 'bg-night'}`} />
      <span className="flex-1">
        <span className="block font-medium">
          {fmtTime(entry.start)} – {entry.end == null ? 'сейчас' : fmtTime(entry.end)}
        </span>
        <span className="block text-sm text-fg-muted">
          {TYPE_LABEL[entry.type]}
          {entry.note ? `, ${entry.note}` : ''}
        </span>
      </span>
      <span className="text-sm font-medium tabular-nums text-fg">{formatDuration((end - entry.start) / 60000)}</span>
    </button>
  );
}
