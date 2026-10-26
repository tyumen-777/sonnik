import { useMemo, useState } from 'react';
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

const PERIODS = [7, 14, 30];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-ink-700/60 p-3">
      <div className="text-xs text-mist/60">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-mist/50">{hint}</div>}
    </div>
  );
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
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Статистика</h1>
        <div className="flex gap-1 rounded-xl bg-ink-800 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1 text-sm ${p === period ? 'bg-ink-600 text-white' : 'text-mist/60'}`}
            >
              {p} дн
            </button>
          ))}
        </div>
      </header>

      <section className="card">
        <h2 className="mb-1 font-semibold">Сон за сутки</h2>
        <p className="mb-3 text-xs text-mist/60">
          Полоса — рекомендация {norm.totalSleepSource} для {norm.label}: {norm.totalSleepH[0]}–{norm.totalSleepH[1]} ч
        </p>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#343a66" strokeDasharray="3 3" />
              <ReferenceArea y1={norm.totalSleepH[0]} y2={norm.totalSleepH[1]} fill="#f5d27a" fillOpacity={0.12} />
              <XAxis dataKey="day" tick={{ fill: '#c9cdf5', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 18]} ticks={[0, 6, 12, 18]} tick={{ fill: '#c9cdf5', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: '#ffffff10' }}
                contentStyle={{ background: '#171b36', border: 'none', borderRadius: 12 }}
                formatter={(v: number, name) => [formatDuration(v * 60), name === 'night' ? 'Ночь' : 'День']}
              />
              <Bar dataKey="night" stackId="s" fill="#7c83f0" />
              <Bar dataKey="nap" stackId="s" fill="#f2a65a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {summary ? (
        <section className="grid grid-cols-2 gap-2">
          <Tile
            label="В среднем за сутки"
            value={formatDuration(summary.avgTotalMin)}
            hint={
              summary.avgTotalMin < norm.totalSleepH[0] * 60 ? 'ниже рекомендации'
              : summary.avgTotalMin > norm.totalSleepH[1] * 60 ? 'выше рекомендации'
              : 'в пределах рекомендации'
            }
          />
          <Tile label="Ночной сон" value={formatDuration(summary.avgNightMin)} />
          <Tile label="Дневной сон" value={formatDuration(summary.avgNapMin)} />
          <Tile label="Дневных снов" value={summary.avgNaps.toFixed(1)} hint={`ориентир ${norm.napsRange.join('–')}`} />
          <Tile
            label="Окно бодрствования"
            value={summary.avgWakeWindowMin != null ? formatDuration(summary.avgWakeWindowMin) : '—'}
            hint={`ориентир ${formatDuration(norm.wakeWindowMin[0])}–${formatDuration(norm.wakeWindowMin[1])}`}
          />
          <Tile label="Дней с записями" value={String(summary.days)} />
        </section>
      ) : (
        <p className="card text-sm text-mist/60">Средние появятся после первого полного дня записей.</p>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">Точность прогноза</h2>
        {accuracy.n < 5 ? (
          <p className="text-sm text-mist/60">
            Появится, когда наберётся несколько дней записей: мы сравним прогноз с тем, когда малыш уснул на самом деле.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Уснул в окне прогноза" value={`${Math.round(accuracy.hitRate * 100)}%`} hint={`${accuracy.n} засыпаний за 14 дней`} />
              <Tile label="Средняя ошибка" value={`±${formatDuration(accuracy.maeMin)}`} />
            </div>
            {Math.abs(accuracy.biasMin) >= 10 && (
              <p className="text-sm text-mist/70">
                Обычно малыш засыпает {accuracy.biasMin > 0 ? 'позже' : 'раньше'} прогноза на{' '}
                {formatDuration(Math.abs(accuracy.biasMin))} — прогноз подстраивается под это с каждым днём.
              </p>
            )}
          </>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Ритм сна</h2>
        {[...stats].reverse().slice(0, 14).map((d) => (
          <div key={d.day} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-mist/60">{fmtShortDay(d.day)}</span>
            <div className="flex-1">
              <DayTimeline entries={sleeps} day={d.day} now={now} compact />
            </div>
          </div>
        ))}
        <div className="ml-14 flex justify-between text-[10px] text-mist/40">
          {['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}</span>)}
        </div>
      </section>
    </div>
  );
}
