import { useState } from 'react';
import { format } from 'date-fns';

interface Props {
  initialName?: string;
  initialBirthDate?: string;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (name: string, birthDate: string) => void;
  onCancel?: () => void;
}

export default function ChildForm({ initialName = '', initialBirthDate = '', submitLabel, disabled, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const today = format(Date.now(), 'yyyy-MM-dd');
  const valid = name.trim() && birthDate && birthDate <= today;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(name.trim(), birthDate);
      }}
    >
      <div>
        <label className="label" htmlFor="child-name">Имя малыша</label>
        <input id="child-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Миша" />
      </div>
      <div>
        <label className="label" htmlFor="child-birth">Дата рождения</label>
        <input id="child-birth" type="date" className="field" value={birthDate} max={today} onChange={(e) => setBirthDate(e.target.value)} />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" className="btn-ghost flex-1" onClick={onCancel}>Отмена</button>
        )}
        <button type="submit" className="btn-primary flex-1" disabled={!valid || disabled}>{submitLabel}</button>
      </div>
    </form>
  );
}
