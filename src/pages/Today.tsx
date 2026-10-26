import { useMemo, useState } from 'react';
import type { Child, SleepType } from '../db/schema';
import { endSleep, startSleep, useSettings, useSleeps } from '../db/repo';
import { predict } from '../engine/predict';
import { addDays, minutesOfDay, startOfDay } from '../engine/time';
import { ageLabel, fmtTime, formatDuration, hhmmToMin } from '../lib/format';
import { useNow } from '../lib/useNow';
import PredictionCard from '../components/PredictionCard';
import DayTimeline from '../components/DayTimeline';
import EntryRow from '../components/EntryRow';
import EntryEditor, { type Draft } from '../components/EntryEditor';
import TypeToggle from '../components/TypeToggle';
import SyncBadge from '../components/SyncBadge';
import Icon from '../components/Icon';

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Today({ child }: { child: Child }) {
  const now = useNow(1000);
  const settings = useSettings();
  const today = startOfDay(now);
  const sleeps = useSleeps(child.id, addDays(today, -8));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [chosenType, setChosenType] = useState<SleepType | null>(null);

  const dayStartMin = hhmmToMin(settings?.dayStart ?? '07:00');
  const nightStartMin = hhmmToMin(settings?.nightStart ?? '19:00');
  // Recompute the forecast once a minute, not on every timer tick.
  const minute = Math.floor(now / 60000);
  const prediction = useMemo(
    () => predict(sleeps ?? [], child.birthDate, Date.now(), { dayStartMin }),
    [sleeps, child.birthDate, minute, dayStartMin],
  );

  if (!sleeps) return null;

  const running = sleeps.find((s) => s.end == null);
  const last = sleeps[sleeps.length - 1];
  const todays = sleeps.filter((s) => (s.end ?? now) > today).reverse();

  const m = minutesOfDay(now);
  const suggestedType: SleepType =
    prediction.state === 'awake' ? prediction.next.kind : m >= nightStartMin || m < dayStartMin - 60 ? 'night' : 'nap';
  const type = chosenType ?? suggestedType;

  const totalToday = todays.reduce((a, s) => a + Math.min(s.end ?? now, now) - Math.max(s.start, today), 0);

  const awakeSince = !running && last?.end ? last.end : null;
  const status = running
    ? { label: running.type === 'nap' ? 'Дневной сон' : 'Ночной сон', since: `уснул в ${fmtTime(running.start)}` }
    : awakeSince
      ? { label: 'Бодрствует', since: `проснулся в ${fmtTime(awakeSince)}` }
      : { label: 'Записей пока нет', since: '' };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 px-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{child.name}</h1>
        <span className="flex items-center gap-3 text-sm text-fg-muted">
          <SyncBadge />
          {ageLabel(child.birthDate, now)}
        </span>
      </header>

      {/* The one loud element: the panel takes the colour of the child's state. */}
      <section
        aria-live="polite"
        className={`rounded-[1.75rem] bg-(--hero) px-5 pt-5 pb-5 text-(--hero-fg) transition-colors duration-700 ${running ? 'hero-asleep' : ''}`}
      >
        <div className="flex items-baseline justify-between gap-3 text-sm text-(--hero-muted)">
          <span className="font-medium">{status.label}</span>
          <span>{status.since}</span>
        </div>
        <div className="mt-1 font-display text-[3.25rem] leading-tight font-semibold tracking-tight tabular-nums">
          {running ? clock(now - running.start) : awakeSince ? clock(now - awakeSince) : '0:00:00'}
        </div>
        <div className="mt-4 space-y-3">
          {!running && <TypeToggle value={type} onChange={setChosenType} />}
          <button
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-on-primary transition active:scale-[0.98]"
            onClick={async () => {
              if (running) await endSleep(running.id);
              else await startSleep(child.id, type);
              setChosenType(null);
            }}
          >
            <Icon name={running ? 'sun' : 'moon'} />
            {running ? 'Проснулся' : 'Уснул'}
          </button>
          <button
            className="w-full py-1 text-sm font-medium text-(--hero-muted) underline underline-offset-4"
            onClick={() => setDraft({ childId: child.id, type: suggestedType, start: now - 3600_000, end: now })}
          >
            Добавить сон вручную
          </button>
        </div>
      </section>

      <PredictionCard
        prediction={prediction}
        now={now}
        onAddNight={() => {
          const morning = new Date(today);
          morning.setMinutes(dayStartMin);
          const evening = addDays(today, -1) + nightStartMin * 60000 + 30 * 60000;
          setDraft({ childId: child.id, type: 'night', start: evening, end: Math.min(morning.getTime(), now) });
        }}
      />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="heading">Сегодня</h2>
          <span className="text-sm text-fg-muted">спал {formatDuration(totalToday / 60000)}</span>
        </div>
        <div className="panel space-y-3">
          <DayTimeline
            entries={sleeps}
            day={today}
            now={now}
            planned={prediction.state === 'awake' ? prediction.plan : []}
            plannedNapMin={prediction.state === 'awake' ? prediction.napLenMin : 60}
          />
          <div className="flex gap-4 text-xs text-fg-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-nap" />дневной</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-night" />ночной</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-fg-muted" />прогноз</span>
          </div>
          {todays.length === 0 ? (
            <p className="text-sm text-fg-muted">Сегодня записей ещё нет. Нажмите «Уснул», когда малыш заснёт.</p>
          ) : (
            <div className="-mx-2 divide-y divide-line">
              {todays.map((s) => (
                <EntryRow key={s.id} entry={s} now={now} onClick={() => setDraft(s)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <p className="px-2 text-center text-xs text-fg-faint">
        Прогноз — ориентир, а не медицинская рекомендация. Если сон малыша вас беспокоит, обратитесь к педиатру.
      </p>

      {draft && <EntryEditor draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
