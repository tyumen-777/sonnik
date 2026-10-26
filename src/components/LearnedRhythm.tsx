import { useMemo } from 'react';
import type { Child } from '../db/schema';
import { useSleeps } from '../db/repo';
import { personalize } from '../engine/predict';
import { addDays, startOfDay } from '../engine/time';
import { formatDuration, minToHhmm } from '../lib/format';

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
    <section className="card space-y-3">
      <h2 className="font-semibold">Ритм: {child.name}</h2>
      {days < MIN_DAYS ? (
        <p className="text-sm text-mist/60">
          Пока прогноз опирается на возрастные ориентиры. После {MIN_DAYS} дней записей здесь появится ритм вашего малыша:
          с каждым днём прогноз всё точнее подстраивается под него.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
            {windows.map((w, i) => (
              <div key={i} className="contents">
                <dt className="text-mist/60">{i < napsPlanned ? `Окно до ${i + 1}-го сна` : 'Окно до ночного сна'}</dt>
                <dd className="tabular-nums">{formatDuration(w)}</dd>
              </div>
            ))}
            {Array.from({ length: napsPlanned }, (_, i) => (
              <div key={`nap-${i}`} className="contents">
                <dt className="text-mist/60">{i + 1}-й дневной сон</dt>
                <dd className="tabular-nums">{formatDuration(napLenAt(i))}</dd>
              </div>
            ))}
            {usualWakeMin != null && (
              <>
                <dt className="text-mist/60">Обычный подъём</dt>
                <dd className="tabular-nums">{minToHhmm(Math.round(usualWakeMin))}</dd>
              </>
            )}
            {usualBedtimeMin != null && (
              <>
                <dt className="text-mist/60">Обычный отбой</dt>
                <dd className="tabular-nums">{minToHhmm(Math.round(usualBedtimeMin))}</dd>
              </>
            )}
          </dl>
          {shorterBy >= 5 && (
            <p className="text-sm text-mist/70">
              Если дневной сон на 30 минут короче обычного, следующее окно бодрствования у малыша короче примерно на{' '}
              {formatDuration(shorterBy)}.
            </p>
          )}
          <p className="text-xs text-mist/50">
            По записям за 2 недели, последние дни важнее. Прогноз пересчитывается после каждой записи.
          </p>
        </>
      )}
    </section>
  );
}
