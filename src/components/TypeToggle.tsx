import type { SleepType } from '../db/schema';
import Icon from './Icon';

export const TYPE_LABEL: Record<SleepType, string> = { nap: 'Дневной сон', night: 'Ночной сон' };

/** Inherits the text colour of where it sits, so it reads both on the sleep panel and in dialogs. */
export default function TypeToggle({ value, onChange }: { value: SleepType; onChange: (t: SleepType) => void }) {
  return (
    <div className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-current/10 p-1" role="radiogroup" aria-label="Тип сна">
      {(['nap', 'night'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            value === t ? 'bg-surface text-fg shadow-sm' : ''
          }`}
        >
          <Icon name={t === 'nap' ? 'sun' : 'moon'} className={`h-4 w-4 ${value === t ? (t === 'nap' ? 'text-warn' : 'text-night') : ''}`} />
          {TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}
