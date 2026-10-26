import type { SleepType } from '../db/schema';

export const TYPE_LABEL: Record<SleepType, string> = { nap: 'Дневной сон', night: 'Ночной сон' };

export default function TypeToggle({ value, onChange }: { value: SleepType; onChange: (t: SleepType) => void }) {
  return (
    <div className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-ink-700 p-1" role="radiogroup">
      {(['nap', 'night'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={`rounded-xl py-2 text-sm font-medium transition ${
            value === t ? (t === 'nap' ? 'bg-nap text-ink-900' : 'bg-night text-ink-900') : 'text-mist/60'
          }`}
        >
          {t === 'nap' ? '☀️ ' : '🌙 '}
          {TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}
