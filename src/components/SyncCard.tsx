import { useState } from 'react';
import type { Child } from '../db/schema';
import {
  cloudEnabled, inviteToChild, isOwner, login, logout, removeMember, syncNow, syncStatusText, useCloudUser,
  useMembers, useSyncState,
} from '../db/cloud';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Account, sync status and family access to the active profile. */
export default function SyncCard({ child }: { child: Child }) {
  const user = useCloudUser();
  const state = useSyncState();
  const members = useMembers(child.realmId) ?? [];
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!cloudEnabled) return null;

  if (!user?.isLoggedIn) {
    return (
      <section className="card space-y-3">
        <h2 className="font-semibold">Синхронизация</h2>
        <p className="text-sm text-mist/70">
          Войдите по почте, чтобы записи появились на всех ваших устройствах и чтобы вести дневник вместе со вторым
          родителем. Без входа всё хранится только на этом устройстве.
        </p>
        <button className="btn-primary w-full" onClick={login}>Войти по почте</button>
      </section>
    );
  }

  const status = syncStatusText(state);
  const owner = isOwner(child, user.userId);

  async function invite() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) return setMessage('Проверьте адрес почты.');
    if (address === user?.email?.toLowerCase()) return setMessage('Это ваш собственный адрес.');
    if (members.some((m) => m.email?.toLowerCase() === address)) return setMessage('Этот человек уже приглашён.');
    setBusy(true);
    try {
      await inviteToChild(child, address);
      setEmail('');
      setMessage(`Приглашение отправлено на ${address}. После входа с этой почты профиль появится у него.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось отправить приглашение');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Синхронизация</h2>
          <p className="text-sm text-mist/60">{user.email}</p>
        </div>
        <span className={`shrink-0 text-right text-sm ${status.tone === 'warn' ? 'text-nap' : status.tone === 'ok' ? 'text-emerald-300' : 'text-mist/70'}`}>
          {status.text}
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Кто ведёт дневник {child.name}</h3>
        <ul className="space-y-1 text-sm">
          <li className="flex justify-between">
            <span>{owner ? 'Вы' : 'Создатель профиля'}</span>
            <span className="text-mist/50">владелец</span>
          </li>
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{m.userId === user.userId ? 'Вы' : m.name || m.email}</span>
              <span className="flex shrink-0 items-center gap-2 text-mist/50">
                {m.rejected ? 'отклонил' : m.accepted ? 'в семье' : 'приглашён'}
                {owner && m.userId !== user.userId && (
                  <button
                    className="text-red-300/80"
                    aria-label={`Убрать доступ: ${m.email}`}
                    onClick={() => confirm(`Убрать доступ к профилю для ${m.email}?`) && removeMember(m.id)}
                  >
                    ✕
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {owner ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              invite();
            }}
          >
            <input
              className="field flex-1"
              type="email"
              inputMode="email"
              placeholder="Почта второго родителя"
              aria-label="Почта второго родителя"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setMessage(null);
              }}
            />
            <button className="btn-primary shrink-0 text-sm" disabled={busy || !email.trim()}>Пригласить</button>
          </form>
        ) : (
          <p className="text-xs text-mist/50">Приглашать может создатель профиля.</p>
        )}
        {message && <p className="text-sm text-mist/70">{message}</p>}
      </div>

      <div className="flex gap-2">
        <button className="btn-ghost flex-1 text-sm" onClick={() => syncNow()}>Обновить</button>
        <button className="btn-ghost flex-1 text-sm" onClick={() => logout()}>Выйти</button>
      </div>
    </section>
  );
}
