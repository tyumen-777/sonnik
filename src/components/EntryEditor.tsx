import { useState } from 'react';
import type { SleepType } from '../db/schema';
import { deleteSleep, saveSleep, type SleepDraft } from '../db/repo';
import { formatDuration, fromLocalInput, toLocalInput } from '../lib/format';
import TypeToggle from './TypeToggle';

export type Draft = SleepDraft;

interface Props {
  draft: Draft;
  onClose: () => void;
}

export default function EntryEditor({ draft, onClose }: Props) {
  const [type, setType] = useState<SleepType>(draft.type);
  const [start, setStart] = useState(toLocalInput(draft.start));
  const [running, setRunning] = useState(draft.end == null);
  const [end, setEnd] = useState(toLocalInput(draft.end ?? Date.now()));
  const [note, setNote] = useState(draft.note ?? '');

  const startTs = fromLocalInput(start);
  const endTs = running ? null : fromLocalInput(end);
  const error =
    !start || Number.isNaN(startTs) ? 'Укажите начало сна'
    : startTs > Date.now() ? 'Начало сна не может быть в будущем'
    : endTs != null && (Number.isNaN(endTs) || endTs <= startTs) ? 'Конец сна должен быть позже начала'
    : endTs != null && endTs - startTs > 16 * 3600_000 ? 'Сон длиннее 16 часов — проверьте время'
    : null;

  async function save() {
    if (error) return;
    await saveSleep({ ...draft, type, start: startTs, end: endTs, note: note.trim() || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={draft.id == null ? 'Новая запись сна' : 'Редактирование сна'}
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-surface p-5 shadow-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold tracking-tight">{draft.id == null ? 'Новая запись' : 'Редактировать сон'}</h2>
        <TypeToggle value={type} onChange={setType} />
        <div>
          <label className="label" htmlFor="sleep-start">Уснул</label>
          <input id="sleep-start" type="datetime-local" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0" htmlFor="sleep-end">Проснулся</label>
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input type="checkbox" checked={running} onChange={(e) => setRunning(e.target.checked)} className="accent-primary" />
              Ещё спит
            </label>
          </div>
          {!running && (
            <input id="sleep-end" type="datetime-local" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
          )}
        </div>
        <div>
          <label className="label" htmlFor="sleep-note">Заметка</label>
          <input id="sleep-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например, уснул в коляске" />
        </div>
        {error ? (
          <p className="text-sm text-warn">{error}</p>
        ) : (
          endTs != null && <p className="text-sm text-fg-muted">Длительность: {formatDuration((endTs - startTs) / 60000)}</p>
        )}
        <div className="flex gap-2">
          {draft.id != null && (
            <button
              className="btn bg-danger-soft text-danger"
              onClick={async () => {
                if (confirm('Удалить эту запись?')) {
                  await deleteSleep(draft.id!);
                  onClose();
                }
              }}
            >
              Удалить
            </button>
          )}
          <button className="btn-ghost flex-1" onClick={onClose}>Отмена</button>
          <button className="btn-primary flex-1" disabled={!!error} onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
