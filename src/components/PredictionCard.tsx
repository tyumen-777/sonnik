import type { Prediction } from '../engine/predict';
import { fmtTime, formatDuration } from '../lib/format';

function relative(target: number, now: number): string {
  const min = Math.round((target - now) / 60000);
  if (Math.abs(min) < 5) return 'сейчас';
  return min > 0 ? `через ${formatDuration(min)}` : `${formatDuration(-min)} назад`;
}

export default function PredictionCard({ prediction: p, now, onAddNight }: { prediction: Prediction; now: number; onAddNight: () => void }) {
  if (p.state === 'empty') {
    return (
      <section className="card space-y-3">
        <h2 className="font-semibold">Построим режим дня</h2>
        <p className="text-sm text-mist/70">
          {p.reason === 'stale'
            ? 'Давно не было записей. Отметьте, когда малыш проснулся или уснул, — и прогноз обновится.'
            : 'Запишите прошлый ночной сон или нажмите «Уснул», когда малыш заснёт. Прогноз появится сразу.'}
        </p>
        <p className="text-sm text-mist/70">
          Ориентир для {p.norm.label}: окно бодрствования {formatDuration(p.norm.wakeWindowMin[0])}–
          {formatDuration(p.norm.wakeWindowMin[1])}, дневных снов: {p.norm.napsRange.join('–')}.
        </p>
        <button className="btn-ghost w-full" onClick={onAddNight}>Записать ночной сон</button>
      </section>
    );
  }

  const warnings = p.warnings.length > 0 && (
    <ul className="space-y-2">
      {p.warnings.map((w, i) => (
        <li key={i} className={`rounded-2xl px-3 py-2 text-sm ${w.level === 'warn' ? 'bg-nap/15 text-nap' : 'bg-night/15 text-mist'}`}>
          {w.text}
        </li>
      ))}
    </ul>
  );

  if (p.state === 'sleeping') {
    return (
      <section className="card space-y-3">
        <div className="text-sm text-mist/60">{p.kind === 'nap' ? 'Ожидаемое пробуждение' : 'Утренний подъём'}</div>
        <div className="text-3xl font-bold tabular-nums">~{fmtTime(p.expectedWake)}</div>
        <div className="text-sm text-mist/60">
          {p.kind === 'nap'
            ? `Обычно дневной сон в этом возрасте — до ${formatDuration(p.norm.maxNapMin)}`
            : `Норма сна за сутки для ${p.norm.label}: ${p.norm.totalSleepH[0]}–${p.norm.totalSleepH[1]} ч`}
        </div>
        {warnings}
      </section>
    );
  }

  const { next } = p;
  const later = p.plan.slice(1);
  return (
    <section className="card space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-mist/60">
          {next.kind === 'nap' ? `Следующий сон · ${p.napsToday + 1}-й дневной` : p.nightWaking ? 'Снова уснёт' : 'Ночной сон'}
        </span>
        <span className="text-sm text-moon">{now > next.to ? 'пора укладывать' : relative(next.target, now)}</span>
      </div>
      <div className="text-3xl font-bold tabular-nums">
        {fmtTime(next.from)}–{fmtTime(next.to)}
      </div>
      <div className="text-sm text-mist/60">
        Окно бодрствования ~{formatDuration(next.wakeWindowMin)} · ориентир для {p.norm.label}
      </div>
      {next.note && <div className="text-sm text-moon/90">{next.note}</div>}
      {later.length > 0 && (
        <ul className="divide-y divide-ink-700 border-t border-ink-700 text-sm">
          {later.map((s, i) => (
            <li key={i} className="flex justify-between py-2">
              <span className="text-mist/70">{s.kind === 'nap' ? `${p.napsToday + i + 2}-й дневной сон` : 'Ночной сон'}</span>
              <span className="tabular-nums">
                ~{fmtTime(s.target)}
                {s.durationMin != null && <span className="text-mist/50"> · {formatDuration(s.durationMin)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {warnings}
    </section>
  );
}
