import { useMemo } from 'react';
import type { Child } from '../db/schema';
import { useSleeps } from '../db/repo';
import { personalize } from '../engine/predict';
import { addDays, startOfDay } from '../engine/time';
import { formatDuration, minToHhmm } from '../lib/format';
import Section from './Section';

const MIN_DAYS = 3;

/** What the forecast has learned about this child, in plain words. */
export default function LearnedRhythm({ child }: { child: Child }) {
  const today = startOfDay(Date.now());
  const sleeps = useSleeps(child.id, addDays(today, -14));
  const learned = useMemo(
    () => (sleeps ? personalize(sleeps, child.birthDate, Date.now()) : null),
    [sleeps, child.birthDate],
  );
  if (!sleeps || !learned) return null;

  const days = new Set(sleeps.filter((s) => s.type === 'night' && s.end != null).map((s) => startOfDay(s.end!))).size;
  const { napsPlanned, napLenMin, napLenAt, usualWakeMin, usualBedtimeMin, wakeWindow } = learned;
  const windows = Array.from({ length: napsPlanned + 1 }, (_, pos) => wakeWindow(pos).min);
  const shorterBy =
    napsPlanned > 0
      ? wakeWindow(1, { prevNapMin: napLenMin }).min - wakeWindow(1, { prevNapMin: napLenMin - 30 }).min
      : 0;

  return (
    <Section title={`Ритм: ${child.name}`}>
      {days < MIN_DAYS ? (
        <p className="text-sm text-fg-muted">
          Пока прогноз опирается на возрастные ориентиры. После {MIN_DAYS} дней записей здесь появится ритм вашего малыша:
          с каждым днём прогноз всё точнее подстраивается под него.
        </p>
      ) : (
        <>
          <dl className="divide-y divide-line text-sm">
            {windows.map((w, i) => (
              <div key={i} className="flex justify-between gap-3 py-2.5">
                <dt className="text-fg-muted">{i < napsPlanned ? `Окно до ${i + 1}-го сна` : 'Окно до ночного сна'}</dt>
                <dd className="text-right font-medium tabular-nums">{formatDuration(w)}</dd>
              </div>
            ))}
            {Array.from({ length: napsPlanned }, (_, i) => (
              <div key={`nap-${i}`} className="flex justify-between gap-3 py-2.5">
                <dt className="text-fg-muted">{i + 1}-й дневной сон</dt>
                <dd className="text-right font-medium tabular-nums">{formatDuration(napLenAt(i))}</dd>
              </div>
            ))}
            {usualWakeMin != null && (
              <div className="flex justify-between gap-3 py-2.5">
                <dt className="text-fg-muted">Обычный подъём</dt>
                <dd className="text-right font-medium tabular-nums">{minToHhmm(Math.round(usualWakeMin))}</dd>
              </div>
            )}
            {usualBedtimeMin != null && (
              <div className="flex justify-between gap-3 py-2.5">
                <dt className="text-fg-muted">Обычный отбой</dt>
                <dd className="text-right font-medium tabular-nums">{minToHhmm(Math.round(usualBedtimeMin))}</dd>
              </div>
            )}
          </dl>
          {shorterBy >= 5 && (
            <p className="text-sm text-fg-muted">
              Если дневной сон на 30 минут короче обычного, следующее окно бодрствования у малыша короче примерно на{' '}
              {formatDuration(shorterBy)}.
            </p>
          )}
          <p className="text-sm text-fg-muted">
            По записям за 2 недели, последние дни важнее. Прогноз пересчитывается после каждой записи.
          </p>
        </>
      )}
    </Section>
  );
}
