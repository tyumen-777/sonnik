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
import Section from '../components/Section';
import type { ThemeChoice } from '../lib/theme';

const THEMES: [ThemeChoice, string][] = [
  ['auto', 'Как в системе'],
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
];

export default function Profile({
  child,
  theme,
  onThemeChange,
}: {
  child: Child;
  theme: ThemeChoice;
  onThemeChange: (t: ThemeChoice) => void;
}) {
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
    <div className="space-y-6">
      <h1 className="px-1 font-display text-2xl font-semibold tracking-tight">Профиль</h1>

      <Section title="Дети">
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
            <div className="-mx-1 space-y-1" role="radiogroup" aria-label="Активный ребёнок">
              {children.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={c.id === child.id}
                  onClick={() => setSetting('activeChildId', c.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left ${
                    c.id === child.id ? 'bg-info-soft' : ''
                  }`}
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm text-fg-muted">{ageLabel(c.birthDate)}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 text-sm" onClick={() => setMode('edit')}>Изменить {child.name}</button>
              <button className="btn-ghost flex-1 text-sm" onClick={() => setMode('add')}>Добавить ребёнка</button>
            </div>
          </>
        )}
      </Section>

      <SyncCard child={child} />

      <LearnedRhythm child={child} />

      <Section title={`Ориентиры для ${norm.label}`}>
        <dl className="divide-y divide-line">
          {[
            ['Сон за сутки', <>{norm.totalSleepH[0]}–{norm.totalSleepH[1]} ч <span className="text-fg-muted">({norm.totalSleepSource})</span></>],
            ['Окно бодрствования', `${formatDuration(norm.wakeWindowMin[0])} – ${formatDuration(norm.wakeWindowMin[1])}`],
            ['Дневных снов', norm.napsRange[0] === norm.napsRange[1] ? norm.naps : norm.napsRange.join('–')],
            ['Дневной сон не дольше', formatDuration(norm.maxNapMin)],
            ['Отбой', `${minToHhmm(norm.bedtime[0])}–${minToHhmm(norm.bedtime[1])}`],
          ].map(([k, v], i) => (
            <div key={i} className="flex justify-between gap-3 py-2.5 text-sm">
              <dt className="text-fg-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <button className="text-sm font-semibold text-link" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Скрыть таблицу' : 'Показать все возрасты'}
        </button>
        {showTable && (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full text-sm">
              <thead className="text-fg-muted">
                <tr className="text-left">
                  <th className="py-1.5 pr-2 font-medium">Возраст</th>
                  <th className="pr-2 font-medium">Сон</th>
                  <th className="pr-2 font-medium">Окно</th>
                  <th className="font-medium">Снов</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {AGE_NORMS.map((n) => (
                  <tr key={n.label} className={n === norm ? 'bg-info-soft font-semibold' : ''}>
                    <td className="py-1.5 pr-2">{n.label}</td>
                    <td className="pr-2">{n.totalSleepH.join('–')} ч</td>
                    <td className="pr-2">{n.wakeWindowMin.map((m) => (m / 60).toFixed(1).replace('.0', '')).join('–')} ч</td>
                    <td>{n.napsRange[0] === n.napsRange[1] ? n.naps : n.napsRange.join('–')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-fg-muted">
          Норма сна за сутки взята из рекомендаций NSF и AASM, одобренных AAP. Окна бодрствования, число снов и время
          отбоя — общепринятые ориентиры педиатров и сомнологов, у каждого ребёнка они свои. Прогноз подстраивается под
          ваши записи за последние две недели.
        </p>
      </Section>

      <Section
        title="Безопасный сон"
        aside={months < 12 && <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-link">важно до года</span>}
      >
        <ul className="list-disc space-y-2 pl-5 text-fg marker:text-fg-faint">
          {SAFE_SLEEP_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="text-sm text-fg-muted">Источник: {SAFE_SLEEP_SOURCE.title}, 2022.</p>
      </Section>

      <Section title="Настройки" className="space-y-4">
        <div>
          <span className="label" id="theme-label">Оформление</span>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={theme === value}
                onClick={() => onThemeChange(value)}
                className={`rounded-xl py-2.5 text-sm font-semibold ${theme === value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
          <button className="btn-ghost flex-1 text-sm" onClick={doExport}>Сохранить копию</button>
          <button className="btn-ghost flex-1 text-sm" onClick={() => fileRef.current?.click()}>Загрузить копию</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }} />
        </div>
        {message && <p className="text-sm text-fg-muted">{message}</p>}
        <button
          className="w-full rounded-xl py-2 text-sm font-semibold text-danger"
          onClick={async () => {
            if (confirm(`Удалить профиль ${child.name} и все записи сна? Это нельзя отменить.`)) await deleteChild(child.id);
          }}
        >
          Удалить профиль {child.name}
        </button>
      </Section>

      <section className="space-y-2 px-1 text-xs text-fg-muted">
        <p className="font-semibold">Источники</p>
        {[...Object.values(SOURCES), SAFE_SLEEP_SOURCE].map((s) => (
          <p key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{s.ref}</a>
          </p>
        ))}
        <p className="pt-2">Приложение не является медицинским изделием и не заменяет консультацию педиатра.</p>
      </section>
    </div>
  );
}
