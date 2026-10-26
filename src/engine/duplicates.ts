/**
 * Two parents may press "Уснул" for the same sleep on two phones, possibly offline. Once synced,
 * the log then has a second running sleep that starts inside one already recorded. Such a running
 * sleep is a duplicate: the earliest record of the sleep wins.
 */
export function findDuplicateSleeps<T extends { id: string; start: number; end: number | null }>(sleeps: T[]): T[] {
  const sorted = [...sleeps].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  return sorted.filter(
    (s, i) =>
      s.end == null &&
      sorted.some((other, j) => j < i && other.start <= s.start && s.start < (other.end ?? Infinity)),
  );
}
