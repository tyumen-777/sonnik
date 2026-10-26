import { useRef, useState } from 'react';
import type { Child } from '../db/schema';
import { db } from '../db/schema';
import { addChild, deleteChild, exportData, importData, setSetting, useChildren, useSettings } from '../db/repo';
import { AGE_NORMS, SAFE_SLEEP_SOURCE, SAFE_SLEEP_TIPS, SOURCES, ageInMonths, normForAge } from '../norms/ageNorms';
import { ageLabel, formatDuration, minToHhmm } from '../lib/format';
import ChildForm from '../components/ChildForm';
import InstallPrompt from '../components/InstallPrompt';
import LearnedRhythm from '../components/LearnedRhythm';
import SyncCard from '../components/SyncCard';

export default function Profile({ child }: { child: Child }) {
  const children = useChildren() ?? [];
  const settings = useSettings();
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view');
  const [showTable, setShowTable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const months = ageInMonths(child.birthDate);
  const norm = normForAge(months);

  async function doExport() {
    const blob = new Blob([JSON.stringify(await exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `napper-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doImport(file: File) {
    try {
      const n = await importData(JSON.parse(await file.text()));
      setMessage(`Из резервной копии добавлено профилей: ${n}. Лишние можно удалить.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Профиль</h1>

      <section className="card space-y-3">
        {mode === 'edit' ? (
          <ChildForm
            initialName={child.name}
            initialBirthDate={child.birthDate}
            submitLabel="Сохранить"
            onCancel={() => setMode('view')}
            onSubmit={async (name, birthDate) => {
              await db.children.update(child.id, { name, birthDate });
              setMode('view');
            }}
          />
        ) : mode === 'add' ? (
          <ChildForm
            submitLabel="Добавить"
            onCancel={() => setMode('view')}
            onSubmit={async (name, birthDate) => {
              await addChild(name, birthDate);
              setMode('view');
            }}
          />
        ) : (
          <>
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setSetting('activeChildId', c.id)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left ${
                  c.id === child.id ? 'bg-ink-700' : ''
                }`}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-mist/60">{ageLabel(c.birthDate)}</span>
              </button>
            ))}
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 text-sm" onClick={() => setMode('edit')}>Изменить</button>
              <button className="btn-ghost flex-1 text-sm" onClick={() => setMode('add')}>+ Ребёнок</button>
            </div>
          </>
        )}
      </section>

      <SyncCard child={child} />

      <LearnedRhythm child={child} />

      <section className="card space-y-3">
        <h2 className="font-semibold">Ориентиры для {norm.label}</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-mist/60">Сон за сутки</dt>
          <dd>{norm.totalSleepH[0]}–{norm.totalSleepH[1]} ч <span className="text-mist/50">({norm.totalSleepSource})</span></dd>
          <dt className="text-mist/60">Окно бодрствования</dt>
          <dd>{formatDuration(norm.wakeWindowMin[0])} – {formatDuration(norm.wakeWindowMin[1])}</dd>
          <dt className="text-mist/60">Дневных снов</dt>
          <dd>{norm.napsRange[0] === norm.napsRange[1] ? norm.naps : norm.napsRange.join('–')}</dd>
          <dt className="text-mist/60">Дневной сон, не дольше</dt>
          <dd>{formatDuration(norm.maxNapMin)}</dd>
          <dt className="text-mist/60">Отбой</dt>
          <dd>{minToHhmm(norm.bedtime[0])}–{minToHhmm(norm.bedtime[1])}</dd>
        </dl>
        <button className="text-sm text-moon" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Скрыть таблицу' : 'Все возрасты'}
        </button>
        {showTable && (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full text-xs">
              <thead className="text-mist/60">
                <tr className="text-left">
                  <th className="py-1 pr-2 font-normal">Возраст</th>
                  <th className="pr-2 font-normal">Сон/сут</th>
                  <th className="pr-2 font-normal">Окно</th>
                  <th className="font-normal">Снов</th>
                </tr>
              </thead>
              <tbody>
                {AGE_NORMS.map((n) => (
                  <tr key={n.label} className={n === norm ? 'text-moon' : ''}>
                    <td className="py-1 pr-2">{n.label}</td>
                    <td className="pr-2">{n.totalSleepH.join('–')} ч</td>
                    <td className="pr-2">{n.wakeWindowMin.map((m) => (m / 60).toFixed(1).replace('.0', '')).join('–')} ч</td>
                    <td>{n.napsRange[0] === n.napsRange[1] ? n.naps : n.napsRange.join('–')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-mist/50">
          Норма сна за сутки — по рекомендациям NSF и AASM (одобрены AAP). Окна бодрствования, число снов и время отбоя —
          общепринятые ориентиры педиатров и сомнологов, у каждого ребёнка они свои. Приложение подстраивает прогноз под
          ваши записи за последние две недели.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Безопасный сон {months < 12 && <span className="ml-1 rounded-full bg-moon/20 px-2 py-0.5 text-xs text-moon">до 1 года</span>}</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-mist/80">
          {SAFE_SLEEP_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="text-xs text-mist/50">Источник: {SAFE_SLEEP_SOURCE.title}, 2022.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Настройки</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="day-start">Обычный подъём</label>
            <input id="day-start" type="time" className="field" value={settings?.dayStart ?? '07:00'}
              onChange={(e) => e.target.value && setSetting('dayStart', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="night-start">Ночь начинается</label>
            <input id="night-start" type="time" className="field" value={settings?.nightStart ?? '19:00'}
              onChange={(e) => e.target.value && setSetting('nightStart', e.target.value)} />
          </div>
        </div>
        <InstallPrompt />
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 text-sm" onClick={doExport}>Экспорт JSON</button>
          <button className="btn-ghost flex-1 text-sm" onClick={() => fileRef.current?.click()}>Импорт</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }} />
        </div>
        {message && <p className="text-sm text-mist/70">{message}</p>}
        <button
          className="w-full text-sm text-red-300/80"
          onClick={async () => {
            if (confirm(`Удалить ${child.name} и все записи сна? Это нельзя отменить.`)) await deleteChild(child.id);
          }}
        >
          Удалить профиль ребёнка
        </button>
      </section>

      <section className="space-y-1 px-2 text-xs text-mist/40">
        <p>Источники:</p>
        {[...Object.values(SOURCES), SAFE_SLEEP_SOURCE].map((s) => (
          <p key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.ref}</a>
          </p>
        ))}
        <p className="pt-2">Приложение не является медицинским изделием и не заменяет консультацию педиатра.</p>
      </section>
    </div>
  );
}
