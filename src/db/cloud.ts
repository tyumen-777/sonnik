import { useEffect } from 'react';
import { useLiveQuery, useObservable } from 'dexie-react-hooks';
import { getTiedRealmId, resolveText, type DXCAlert, type SyncState } from 'dexie-cloud-addon';
import { findDuplicateSleeps } from '../engine/duplicates';
import { CLOUD_URL, db, type Child } from './schema';
import { deleteSleeps } from './repo';

export const cloudEnabled = Boolean(CLOUD_URL);

export function useCloudUser() {
  return useObservable(db.cloud.currentUser);
}

export function useSyncState(): SyncState | undefined {
  return useObservable(db.cloud.syncState);
}

export function useInvites() {
  return useObservable(db.cloud.invites) ?? [];
}

export function useUserInteraction() {
  return useObservable(db.cloud.userInteraction);
}

/** Family members invited to the profile, the owner not included. */
export function useMembers(realmId: string | undefined) {
  return useLiveQuery(
    () => (realmId ? db.members.filter((m) => m.realmId === realmId).toArray() : []),
    [realmId],
  );
}

/** Starts the email-code login; the dialog is rendered by LoginDialog. Cancelling is not an error. */
export async function login() {
  try {
    await db.cloud.login();
  } catch (e) {
    console.info('Вход прерван', e);
  }
}

export function logout() {
  return db.cloud.logout();
}

export function syncNow() {
  return db.cloud.sync({ wait: false, purpose: 'pull' });
}

/**
 * Shares the profile with another parent by email. The first invite moves the profile and all its
 * sleeps into a realm of their own (an access group tied to the profile); further invites reuse it.
 */
export async function inviteToChild(child: Child, email: string) {
  const realmId = getTiedRealmId(child.id);
  await db.transaction('rw', [db.children, db.sleeps, db.realms, db.members], async () => {
    if (child.realmId !== realmId) {
      await db.realms.put({ realmId, name: `Профиль: ${child.name}`, represents: 'профиль ребёнка' });
      await db.children.update(child.id, { realmId });
      await db.sleeps.where('childId').equals(child.id).modify({ realmId });
    }
    await db.members.add({ realmId, email, invite: true, permissions: { manage: '*' } });
  });
}

export function removeMember(id: string) {
  return db.members.delete(id);
}

/** Owner of a profile is whoever created it; only they can invite and remove family members. */
export function isOwner(child: Child, userId: string | undefined) {
  return !child.owner || child.owner === userId;
}

/** Deletes duplicate running sleeps of the child as soon as synced data brings them in. */
export function useDuplicateCleanup(childId: string | undefined) {
  const running = useLiveQuery(
    () => (childId ? db.sleeps.where('childId').equals(childId).filter((s) => s.end == null).toArray() : []),
    [childId],
  );
  useEffect(() => {
    if (!childId || !running || running.length < 2) return;
    // Look only at the recent past: a running sleep cannot have started earlier than that.
    const since = Math.min(...running.map((s) => s.start)) - 24 * 3600_000;
    db.sleeps
      .where('[childId+start]')
      .between([childId, since], [childId, Infinity])
      .toArray()
      .then((recent) => {
        const dups = findDuplicateSleeps(recent);
        if (dups.length) deleteSleeps(dups.map((s) => s.id));
      });
  }, [childId, running]);
}

export function syncStatusText(state: SyncState | undefined): { text: string; tone: 'ok' | 'busy' | 'warn' } {
  if (state?.license && state.license !== 'ok') return { text: 'Лицензия облачной базы истекла', tone: 'warn' };
  switch (state?.phase) {
    case 'in-sync':
      return { text: 'Синхронизировано', tone: 'ok' };
    case 'pushing':
    case 'pulling':
      return { text: 'Синхронизация…', tone: 'busy' };
    case 'offline':
      return { text: 'Нет сети — записи сохранены на устройстве', tone: 'warn' };
    case 'error':
      return { text: 'Ошибка синхронизации', tone: 'warn' };
    default:
      return { text: 'Ожидает синхронизации', tone: 'busy' };
  }
}

const ALERTS_RU: Partial<Record<DXCAlert['messageCode'], string>> = {
  INVALID_OTP: 'Неверный код. Проверьте письмо и попробуйте ещё раз.',
  INVALID_EMAIL: 'Проверьте адрес электронной почты.',
  LICENSE_LIMIT_REACHED: 'Достигнут лимит пользователей облачной базы.',
  NO_SEATS_AVAILABLE: 'Достигнут лимит пользователей облачной базы.',
  USER_NOT_REGISTERED: 'Для этого адреса вход закрыт.',
  USER_NOT_ACCEPTED: 'Для этого адреса вход закрыт.',
  USER_DEACTIVATED: 'Аккаунт отключён.',
  LOGOUT_CONFIRMATION: 'Есть изменения, которые ещё не ушли в облако. При выходе они пропадут с этого устройства.',
};

/** Russian text of a Dexie Cloud alert; untranslated technical details are kept separately. */
export function alertText(alert: DXCAlert): { text: string; detail?: string } {
  if (alert.messageCode === 'OTP_SENT') {
    const email = alert.messageParams.email;
    return { text: email ? `Мы отправили код на ${email}.` : 'Мы отправили код на вашу почту.' };
  }
  if (alert.messageCode === 'GENERIC_ERROR') {
    return {
      text: 'Не удалось связаться с сервером синхронизации. Проверьте интернет и попробуйте ещё раз.',
      detail: resolveText(alert),
    };
  }
  return { text: ALERTS_RU[alert.messageCode] ?? resolveText(alert) };
}
