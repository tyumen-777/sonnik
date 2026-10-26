import { useLiveQuery } from 'dexie-react-hooks';
import { getTiedRealmId } from 'dexie-cloud-addon';
import { db, type Child, type SleepEntry, type SleepType } from './schema';

export interface AppSettings {
  activeChildId: string | null;
  /** "HH:mm" — earliest usual morning wake */
  dayStart: string;
  /** "HH:mm" — from this time a new sleep is suggested as night sleep */
  nightStart: string;
}

const DEFAULTS: AppSettings = { activeChildId: null, dayStart: '07:00', nightStart: '19:00' };

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as AppSettings;
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  return db.settings.put({ key, value });
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(getSettings, []);
}

export function useChildren(): Child[] | undefined {
  return useLiveQuery(() => db.children.orderBy('createdAt').toArray(), []);
}

export function useActiveChild(): { child: Child | null; loading: boolean } {
  const settings = useSettings();
  const children = useChildren();
  if (!settings || !children) return { child: null, loading: true };
  const child = children.find((c) => c.id === settings.activeChildId) ?? children[0] ?? null;
  return { child, loading: false };
}

/** All sleeps of the child with start >= since, sorted by start. */
export function useSleeps(childId: string | undefined, since = 0): SleepEntry[] | undefined {
  return useLiveQuery(
    () =>
      childId == null
        ? []
        : db.sleeps.where('[childId+start]').between([childId, since], [childId, Infinity]).toArray(),
    [childId, since],
  );
}

export async function addChild(name: string, birthDate: string) {
  const id = await db.children.add({ name, birthDate, createdAt: Date.now() });
  await setSetting('activeChildId', id);
  return id;
}

export async function deleteChild(id: string) {
  await db.transaction('rw', [db.children, db.sleeps, db.settings, db.realms, db.members], async () => {
    const child = await db.children.get(id);
    await db.sleeps.where('childId').equals(id).delete();
    await db.children.delete(id);
    // A shared profile has its own realm: removing it revokes everyone's access.
    if (child?.realmId === getTiedRealmId(id)) {
      await db.members.where('realmId').equals(child.realmId).delete();
      await db.realms.delete(child.realmId);
    }
    const s = await getSettings();
    if (s.activeChildId === id) {
      const next = await db.children.orderBy('createdAt').first();
      await setSetting('activeChildId', next?.id ?? null);
    }
  });
}

/** Realm of the child, so a new sleep is visible to everyone the profile is shared with. */
async function realmOf(childId: string): Promise<{ realmId?: string }> {
  const child = await db.children.get(childId);
  return child?.realmId ? { realmId: child.realmId } : {};
}

export async function startSleep(childId: string, type: SleepType, at = Date.now()) {
  const realm = await realmOf(childId);
  return db.transaction('rw', db.sleeps, async () => {
    // Close any sleep still open, so there is never more than one running.
    await db.sleeps.where('childId').equals(childId).filter((s) => s.end == null).modify({ end: at });
    return db.sleeps.add({ childId, start: at, end: null, type, ...realm });
  });
}

export function endSleep(id: string, at = Date.now()) {
  return db.sleeps.update(id, { end: at });
}

export type SleepDraft = Omit<SleepEntry, 'id' | 'realmId' | 'owner'> & { id?: string };

export async function saveSleep(entry: SleepDraft) {
  const { id, childId, start, end, type, note } = entry;
  const data = { childId, start, end, type, note };
  if (id != null) return db.sleeps.update(id, data);
  return db.sleeps.add({ ...data, ...(await realmOf(entry.childId)) });
}

export function deleteSleep(id: string) {
  return db.sleeps.delete(id);
}

/** Removes duplicate running sleeps that appear when two devices recorded the same sleep. */
export function deleteSleeps(ids: string[]) {
  return db.sleeps.bulkDelete(ids);
}

export async function exportData() {
  return {
    app: 'napper',
    version: 2,
    exportedAt: new Date().toISOString(),
    children: await db.children.toArray(),
    sleeps: await db.sleeps.toArray(),
  };
}

/**
 * Restores profiles from a backup as new profiles next to the existing ones. Nothing is overwritten:
 * with sync, wiping the tables would also wipe data shared with the family.
 */
export async function importData(data: unknown): Promise<number> {
  const d = data as { app?: string; children?: Child[]; sleeps?: SleepEntry[] };
  if (d?.app !== 'napper' || !Array.isArray(d.children) || !Array.isArray(d.sleeps)) {
    throw new Error('Файл не похож на резервную копию приложения');
  }
  const { children, sleeps } = d as Required<typeof d>;
  await db.transaction('rw', db.children, db.sleeps, async () => {
    // Backups of older versions have numeric ids, so ids are always reissued.
    const ids = new Map<string, string>();
    for (const c of children) {
      ids.set(String(c.id), await db.children.add({ name: c.name, birthDate: c.birthDate, createdAt: c.createdAt }));
    }
    await db.sleeps.bulkAdd(
      sleeps
        .filter((s) => ids.has(String(s.childId)))
        .map((s) => ({ childId: ids.get(String(s.childId))!, start: s.start, end: s.end, type: s.type, note: s.note })),
    );
  });
  return children.length;
}
