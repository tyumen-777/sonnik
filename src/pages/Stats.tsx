import { useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Child } from '../db/schema';
import { useSleeps } from '../db/repo';
import { dailyStats, summarize } from '../engine/stats';
import { backtest } from '../engine/backtest';
import { addDays, startOfDay } from '../engine/time';
import { ageInMonths, normForAge } from '../norms/ageNorms';
import { fmtShortDay, formatDuration } from '../lib/format';
import { useNow } from '../lib/useNow';
import DayTimeline from '../components/DayTimeline';
import Section from '../components/Section';

const PERIODS = [7, 14, 30];

/** One figure in the hairline grid of averages. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface p-3">
      <div className="text-sm text-fg-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-sm text-fg-muted">{hint}</div>}
    </div>
  );
}

function Figures({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">{children}</div>;
}

export default function Stats({ child }: { child: Child }) {
  const now = useNow(60_000);
  const [period, setPeriod] = useState(7);
  const today = startOfDay(now);
  const first = addDays(today, -(period - 1));
  // Accuracy is scored over the last 14 days, with two more weeks before them as history.
  const accuracySince = addDays(today, -13);
  const all = useSleeps(child.id, addDays(Math.min(first, accuracySince), -15));
  const accuracy = useMemo(
    () => (all ? backtest(all, child.birthDate, { since: accuracySince }) : null),
    [all, child.birthDate, accuracySince],
  );
  if (!all || !accuracy) return null;
  const sleeps = all.filter((s) => (s.end ?? now) >= addDays(first, -1));

  const norm = normForAge(ageInMonths(child.birthDate, now));
  // Today is still in progress, so it is excluded from the averages.
  const stats = dailyStats(sleeps, first, period, now);
  const summary = summarize(stats.slice(0, -1));
  const chart = stats.map((d) => ({
    day: fmtShortDay(d.day),
    night: +(d.nightMin / 60).toFixed(2),
    nap: +(d.napMin / 60).toFixed(2),
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-3 px-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Статистика</h1>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Период">
          {PERIODS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={p === period}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${p === period ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'}`}
            >
              {p} дней
            </button>
          ))}
        </div>
      </header>

      <Section title="Сон за сутки" className="space-y-2">
        <p className="text-sm text-fg-muted">
          Выделенная полоса — рекомендация {norm.totalSleepSource} для {norm.label}: {norm.totalSleepH[0]}–{norm.totalSleepH[1]} ч.
        </p>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <ReferenceArea y1={norm.totalSleepH[0]} y2={norm.totalSleepH[1]} fill="var(--info-soft)" fillOpacity={1} />
              <XAxis dataKey="day" tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 18]} ticks={[0, 6, 12, 18]} tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)', fillOpacity: 0.6 }}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--fg)' }}
                labelStyle={{ color: 'var(--fg)', fontWeight: 600 }}
                formatter={(v: number, name) => [formatDuration(v * 60), name === 'night' ? 'Ночной' : 'Дневной']}
              />
              <Bar dataKey="night" stackId="s" fill="var(--night)" />
              <Bar dataKey="nap" stackId="s" fill="var(--nap)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-sm text-fg-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-night" />ночной</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-nap" />дневной</span>
        </div>
      </Section>

      <Section title="В среднем за день">
        {summary ? (
          <Figures>
            <Figure
              label="Сон за сутки"
              value={formatDuration(summary.avgTotalMin)}
              hint={
                summary.avgTotalMin < norm.totalSleepH[0] * 60 ? 'ниже рекомендации'
                : summary.avgTotalMin > norm.totalSleepH[1] * 60 ? 'выше рекомендации'
                : 'в пределах рекомендации'
              }
            />
            <Figure label="Ночной сон" value={formatDuration(summary.avgNightMin)} />
            <Figure label="Дневной сон" value={formatDuration(summary.avgNapMin)} />
            <Figure label="Дневных снов" value={summary.avgNaps.toFixed(1).replace('.', ',')} hint={`ориентир ${norm.napsRange.join('–')}`} />
            <Figure
              label="Окно бодрствования"
              value={summary.avgWakeWindowMin != null ? formatDuration(summary.avgWakeWindowMin) : 'нет данных'}
              hint={`ориентир ${formatDuration(norm.wakeWindowMin[0])}–${formatDuration(norm.wakeWindowMin[1])}`}
            />
            <Figure label="Дней с записями" value={String(summary.days)} />
          </Figures>
        ) : (
          <p className="text-fg-muted">Средние появятся после первого полного дня записей.</p>
        )}
      </Section>

      <Section title="Точность прогноза">
        {accuracy.n < 5 ? (
          <p className="text-fg-muted">
            Появится через несколько дней записей: приложение сравнит прогноз с тем, когда малыш уснул на самом деле.
          </p>
        ) : (
          <>
            <Figures>
              <Figure label="Уснул в окне прогноза" value={`${Math.round(accuracy.hitRate * 100)}%`} hint={`${accuracy.n} засыпаний за 14 дней`} />
              <Figure label="Средняя ошибка" value={`±${formatDuration(accuracy.maeMin)}`} />
            </Figures>
            {Math.abs(accuracy.biasMin) >= 10 && (
              <p className="text-sm text-fg-muted">
                Обычно малыш засыпает {accuracy.biasMin > 0 ? 'позже' : 'раньше'} прогноза на{' '}
                {formatDuration(Math.abs(accuracy.biasMin))}. Прогноз подстраивается под это с каждым днём.
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="Ритм сна" className="space-y-2">
        {[...stats].reverse().slice(0, 14).map((d) => (
          <div key={d.day} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-sm text-fg-muted">{fmtShortDay(d.day)}</span>
            <div className="flex-1">
              <DayTimeline entries={sleeps} day={d.day} now={now} compact />
            </div>
          </div>
        ))}
        <div className="ml-16 flex justify-between text-xs text-fg-muted tabular-nums">
          {['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}</span>)}
        </div>
      </Section>
    </div>
  );
}
