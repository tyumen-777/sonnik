import Icon from './Icon';
import { cloudEnabled, syncStatusText, useCloudUser, useSyncState } from '../db/cloud';

const DOT = { ok: 'bg-ok', busy: 'bg-link animate-pulse', warn: 'bg-warn' } as const;

/** Small sync indicator for headers; hidden when sync is not set up or the user is not signed in. */
export default function SyncBadge() {
  const user = useCloudUser();
  const state = useSyncState();
  if (!cloudEnabled || !user?.isLoggedIn) return null;
  const { text, tone } = syncStatusText(state);
  return (
    <span className="relative inline-flex text-fg-muted" title={text} role="img" aria-label={text}>
      <Icon name="cloud" className="h-5 w-5" />
      <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg ${DOT[tone]}`} />
    </span>
  );
}
