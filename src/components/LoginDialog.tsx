import { useEffect, useState } from 'react';
import type { DXCUserInteraction } from 'dexie-cloud-addon';
import { alertText, useUserInteraction } from '../db/cloud';

const TEXT: Record<DXCUserInteraction['type'], { title: string; submit: string }> = {
  email: { title: 'Вход для синхронизации', submit: 'Получить код' },
  otp: { title: 'Код из письма', submit: 'Войти' },
  'message-alert': { title: 'Синхронизация', submit: 'Понятно' },
  'logout-confirmation': { title: 'Выйти из аккаунта?', submit: 'Выйти' },
  generic: { title: 'Синхронизация', submit: 'Продолжить' },
};

const FIELD_LABEL: Record<string, { label: string; placeholder?: string; inputMode?: 'email' | 'numeric' }> = {
  email: { label: 'Электронная почта', placeholder: 'name@example.com', inputMode: 'email' },
  otp: { label: 'Код из письма', placeholder: '12345678', inputMode: 'numeric' },
};

/** Renders the steps of the Dexie Cloud login (email, then one-time code) in Russian. */
export default function LoginDialog() {
  const interaction = useUserInteraction();
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => setValues({}), [interaction]);
  if (!interaction) return null;

  const text = TEXT[interaction.type] ?? TEXT.generic;
  const fields = Object.entries(interaction.fields ?? {}) as [string, { type: string }][];
  const ready = fields.every(([name]) => values[name]?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <form
        role="dialog"
        aria-label={text.title}
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-ink-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) interaction.onSubmit(Object.fromEntries(fields.map(([n]) => [n, values[n].trim()])));
        }}
      >
        <h2 className="text-lg font-semibold">{text.title}</h2>
        {interaction.type === 'email' && (
          <p className="text-sm text-mist/70">
            Пришлём код на почту. После входа записи появятся на всех ваших устройствах, и вы сможете пригласить второго
            родителя.
          </p>
        )}
        {interaction.alerts.map((a, i) => {
          const { text: message, detail } = alertText(a);
          return (
            <div key={i} className={`rounded-2xl px-3 py-2 text-sm ${a.type === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-night/15 text-mist'}`}>
              <p>{message}</p>
              {detail && <p className="mt-1 break-words text-xs opacity-60">{detail}</p>}
            </div>
          );
        })}
        {fields.map(([name, field], i) => {
          const meta = FIELD_LABEL[name] ?? { label: name };
          return (
            <div key={name}>
              <label className="label" htmlFor={`dxc-${name}`}>{meta.label}</label>
              <input
                id={`dxc-${name}`}
                className="field"
                type={field.type === 'password' ? 'password' : name === 'email' ? 'email' : 'text'}
                inputMode={meta.inputMode}
                autoComplete={name === 'otp' ? 'one-time-code' : name === 'email' ? 'email' : 'off'}
                placeholder={meta.placeholder}
                autoFocus={i === 0}
                value={values[name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
              />
            </div>
          );
        })}
        <div className="flex gap-2">
          {interaction.type !== 'message-alert' && (
            <button type="button" className="btn-ghost flex-1" onClick={() => interaction.onCancel()}>Отмена</button>
          )}
          <button type="submit" className="btn-primary flex-1" disabled={!ready}>{text.submit}</button>
        </div>
      </form>
    </div>
  );
}
