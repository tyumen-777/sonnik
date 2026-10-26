import { useMemo, useState } from 'react';
import type { Child, SleepType } from '../db/schema';
import { endSleep, startSleep, useSettings, useSleeps } from '../db/repo';
import { predict } from '../engine/predict';
import { addDays, minutesOfDay, startOfDay } from '../engine/time';
import { ageLabel, formatDuration, hhmmToMin } from '../lib/format';
import { useNow } from '../lib/useNow';
import PredictionCard from '../components/PredictionCard';
import DayTimeline from '../components/DayTimeline';
import EntryRow from '../components/EntryRow';
import EntryEditor, { type Draft } from '../components/EntryEditor';
import TypeToggle from '../components/TypeToggle';
import SyncBadge from '../components/SyncBadge';

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

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">{child.name}</h1>
        <span className="flex items-center gap-3 text-sm text-mist/60">
          <SyncBadge />
          {ageLabel(child.birthDate, now)}
        </span>
      </header>

      <section className="card flex flex-col items-center gap-4 py-6">
        <div className="text-sm text-mist/60">
          {running ? (running.type === 'nap' ? 'Дневной сон' : 'Ночной сон') : last?.end ? 'Бодрствует' : 'Нет записей'}
        </div>
        <div className="text-5xl font-bold tabular-nums">
          {running ? clock(now - running.start) : last?.end ? clock(now - last.end) : '—'}
        </div>
        {!running && <TypeToggle value={type} onChange={setChosenType} />}
        <button
          className={`h-36 w-36 rounded-full text-lg font-bold shadow-lg transition active:scale-95 ${
            running ? 'bg-moon text-ink-900 shadow-moon/20' : 'bg-night text-ink-900 shadow-night/20'
          }`}
          onClick={async () => {
            if (running) await endSleep(running.id);
            else await startSleep(child.id, type);
            setChosenType(null);
          }}
        >
          {running ? '☀️ Проснулся' : '😴 Уснул'}
        </button>
        <button
          className="text-sm text-mist/60 underline underline-offset-4"
          onClick={() => setDraft({ childId: child.id, type: suggestedType, start: now - 3600_000, end: now })}
        >
          Добавить вручную
        </button>
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

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Сегодня</h2>
          <span className="text-sm text-mist/60">сон {formatDuration(totalToday / 60000)}</span>
        </div>
        <DayTimeline
          entries={sleeps}
          day={today}
          now={now}
          planned={prediction.state === 'awake' ? prediction.plan : []}
          plannedNapMin={prediction.state === 'awake' ? prediction.napLenMin : 60}
        />
        <div className="flex gap-4 text-xs text-mist/50">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-nap" />день</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-night" />ночь</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-dashed border-mist/60" />прогноз</span>
        </div>
        {todays.length === 0 ? (
          <p className="text-sm text-mist/50">Пока нет записей за сегодня.</p>
        ) : (
          <div className="-mx-2">
            {todays.map((s) => (
              <EntryRow key={s.id} entry={s} now={now} onClick={() => setDraft(s)} />
            ))}
          </div>
        )}
      </section>

      <p className="px-2 text-center text-xs text-mist/40">
        Прогноз — ориентир, а не медицинская рекомендация. Если сон малыша вас беспокоит, обратитесь к педиатру.
      </p>

      {draft && <EntryEditor draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
