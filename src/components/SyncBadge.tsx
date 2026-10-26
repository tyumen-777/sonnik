import { cloudEnabled, syncStatusText, useCloudUser, useSyncState } from '../db/cloud';

const DOT = { ok: 'bg-emerald-400', busy: 'bg-moon animate-pulse', warn: 'bg-nap' } as const;

/** Small sync indicator for headers; hidden when sync is not set up or the user is not signed in. */
export default function SyncBadge() {
  const user = useCloudUser();
  const state = useSyncState();
  if (!cloudEnabled || !user?.isLoggedIn) return null;
  const { text, tone } = syncStatusText(state);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-mist/60" title={text} aria-label={text}>
      <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
      ☁︎
    </span>
  );
}
