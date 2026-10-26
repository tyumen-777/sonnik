import Dexie from 'dexie';
import { LEGACY_DB_NAME, db, type SleepType } from './schema';

interface LegacyChild {
  id: number;
  name: string;
  birthDate: string;
  createdAt: number;
}

interface LegacySleep {
  childId: number;
  start: number;
  end: number | null;
  type: SleepType;
  note?: string;
}

/**
 * Moves data from the first, local-only version of the database (numeric ids) into the synced one,
 * giving every record a new global id, then deletes the old database. Runs once; a no-op afterwards.
 */
export async function migrateLegacyData(): Promise<void> {
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return;

  const legacy = new Dexie(LEGACY_DB_NAME);
  legacy.version(1).stores({ children: '++id, createdAt', sleeps: '++id, childId, start, [childId+start]', settings: 'key' });
  const [children, sleeps, settings] = await Promise.all([
    legacy.table<LegacyChild>('children').toArray(),
    legacy.table<LegacySleep>('sleeps').toArray(),
    legacy.table<{ key: string; value: unknown }>('settings').toArray(),
  ]);
  legacy.close();

  await db.transaction('rw', db.children, db.sleeps, db.settings, async () => {
    const ids = new Map<number, string>();
    for (const c of children) {
      ids.set(c.id, await db.children.add({ name: c.name, birthDate: c.birthDate, createdAt: c.createdAt }));
    }
    await db.sleeps.bulkAdd(
      sleeps
        .filter((s) => ids.has(s.childId))
        .map((s) => ({ childId: ids.get(s.childId)!, start: s.start, end: s.end, type: s.type, note: s.note })),
    );
    for (const s of settings) {
      const value = s.key === 'activeChildId' ? (ids.get(s.value as number) ?? null) : s.value;
      await db.settings.put({ key: s.key, value });
    }
  });

  await Dexie.delete(LEGACY_DB_NAME);
}
