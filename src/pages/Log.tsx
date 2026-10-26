import { useState } from 'react';
import type { Child } from '../db/schema';
import { useSleeps } from '../db/repo';
import { dailyStats } from '../engine/stats';
import { addDays, startOfDay } from '../engine/time';
import { fmtDay, formatDuration, plural } from '../lib/format';
import Section from '../components/Section';
import { useNow } from '../lib/useNow';
import DayTimeline from '../components/DayTimeline';
import EntryRow from '../components/EntryRow';
import EntryEditor, { type Draft } from '../components/EntryEditor';

const PAGE = 14;

export default function Log({ child }: { child: Child }) {
  const now = useNow(60_000);
  const today = startOfDay(now);
  const [days, setDays] = useState(PAGE);
  const first = addDays(today, -(days - 1));
  // Load one extra day so night sleep that started the evening before is visible on the first day.
  const sleeps = useSleeps(child.id, addDays(first, -1));
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!sleeps) return null;
  const stats = dailyStats(sleeps, first, days, now).reverse();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 px-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Журнал</h1>
        <button
          className="btn-primary py-2.5 text-sm"
          onClick={() => setDraft({ childId: child.id, type: 'nap', start: now - 3600_000, end: now })}
        >
          Добавить сон
        </button>
      </header>

      {stats.map((d) => {
        const next = addDays(d.day, 1);
        const entries = sleeps.filter((s) => s.start >= d.day && s.start < next).reverse();
        if (!entries.length && d.totalMin === 0) return null;
        return (
          <Section
            key={d.day}
            title={<span className="first-letter:uppercase">{fmtDay(d.day)}</span>}
            aside={
              <span className="shrink-0 text-right text-sm text-fg-muted">
                {formatDuration(d.totalMin)}, {plural(d.naps, ['дневной сон', 'дневных сна', 'дневных снов'])}
              </span>
            }
          >
            <DayTimeline entries={sleeps} day={d.day} now={now} compact />
            <div className="-mx-2 divide-y divide-line">
              {entries.map((s) => (
                <EntryRow key={s.id} entry={s} now={now} onClick={() => setDraft(s)} />
              ))}
            </div>
          </Section>
        );
      })}

      {sleeps.length === 0 && (
        <p className="px-1 text-fg-muted">Записей пока нет. Добавьте прошлый сон кнопкой выше или нажмите «Уснул» на главном экране.</p>
      )}
      {sleeps.length > 0 && (
        <button className="btn-ghost w-full" onClick={() => setDays((n) => n + PAGE)}>
          Показать ещё
        </button>
      )}

      {draft && <EntryEditor draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
