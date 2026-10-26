import type { Prediction, Warning } from '../engine/predict';
import { fmtTime, formatDuration } from '../lib/format';
import Icon from './Icon';
import Section from './Section';

function relative(target: number, now: number): string {
  const min = Math.round((target - now) / 60000);
  if (Math.abs(min) < 5) return 'сейчас';
  return min > 0 ? `через ${formatDuration(min)}` : `${formatDuration(-min)} назад`;
}

function Warnings({ items }: { items: Warning[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((w, i) => (
        <li
          key={i}
          role={w.level === 'warn' ? 'alert' : undefined}
          className={`rounded-xl px-3 py-2.5 text-sm font-medium ${w.level === 'warn' ? 'bg-warn-soft text-warn' : 'bg-info-soft text-fg'}`}
        >
          {w.text}
        </li>
      ))}
    </ul>
  );
}

export default function PredictionCard({ prediction: p, now, onAddNight }: { prediction: Prediction; now: number; onAddNight: () => void }) {
  if (p.state === 'empty') {
    return (
      <Section title="Режим дня">
        <p className="text-fg">
          {p.reason === 'stale'
            ? 'Давно не было записей. Отметьте, когда малыш проснулся или уснул, и прогноз обновится.'
            : 'Запишите прошлый ночной сон или нажмите «Уснул», когда малыш заснёт. Прогноз появится сразу.'}
        </p>
        <p className="text-sm text-fg-muted">
          Ориентир для {p.norm.label}: окно бодрствования {formatDuration(p.norm.wakeWindowMin[0])}–
          {formatDuration(p.norm.wakeWindowMin[1])}, дневных снов {p.norm.napsRange.join('–')}.
        </p>
        <button className="btn-ghost w-full" onClick={onAddNight}>Записать ночной сон</button>
      </Section>
    );
  }

  if (p.state === 'sleeping') {
    return (
      <Section title={p.kind === 'nap' ? 'Проснётся' : 'Утренний подъём'}>
        <Warnings items={p.warnings} />
        <div className="font-display text-3xl font-semibold tabular-nums">около {fmtTime(p.expectedWake)}</div>
        <p className="text-sm text-fg-muted">
          {p.kind === 'nap'
            ? `Дневной сон в этом возрасте обычно не дольше ${formatDuration(p.norm.maxNapMin)}.`
            : `Сон за сутки для ${p.norm.label}: ${p.norm.totalSleepH[0]}–${p.norm.totalSleepH[1]} ч.`}
        </p>
      </Section>
    );
  }

  const { next } = p;
  const later = p.plan.slice(1);
  const overdue = now > next.to;
  return (
    <Section
      title={next.kind === 'nap' ? `${p.napsToday + 1}-й дневной сон` : p.nightWaking ? 'Снова уснёт' : 'Ночной сон'}
      aside={
        <span className={`text-sm font-semibold ${overdue ? 'text-warn' : 'text-link'}`}>
          {overdue ? 'пора укладывать' : relative(next.target, now)}
        </span>
      }
    >
      <Warnings items={p.warnings} />
      <div className="font-display text-3xl font-semibold tracking-tight tabular-nums">
        {fmtTime(next.from)}–{fmtTime(next.to)}
      </div>
      <p className="text-sm text-fg-muted">
        Окно бодрствования около {formatDuration(next.wakeWindowMin)}, ориентир для {p.norm.label}.
      </p>
      {next.note && <p className="text-sm font-medium text-fg">{next.note}</p>}
      {later.length > 0 && (
        <ol className="divide-y divide-line border-t border-line">
          {later.map((s, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <Icon name={s.kind === 'nap' ? 'sun' : 'moon'} className={`h-5 w-5 shrink-0 ${s.kind === 'nap' ? 'text-warn' : 'text-night'}`} />
              <span className="flex-1 text-fg">{s.kind === 'nap' ? `${p.napsToday + i + 2}-й дневной сон` : 'Ночной сон'}</span>
              <span className="text-right tabular-nums">
                <span className="font-semibold">{fmtTime(s.target)}</span>
                {s.durationMin != null && <span className="block text-xs text-fg-muted">{formatDuration(s.durationMin)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
