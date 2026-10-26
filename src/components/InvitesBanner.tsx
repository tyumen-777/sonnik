import { useState } from 'react';
import { useInvites } from '../db/cloud';

/** Invitations to a family member's profile, shown until accepted or declined. */
export default function InvitesBanner() {
  const invites = useInvites().filter((i) => !i.accepted && !i.rejected);
  const [busy, setBusy] = useState<string | null>(null);
  if (!invites.length) return null;

  return (
    <div className="space-y-2">
      {invites.map((inv) => (
        <section key={inv.id} className="panel space-y-3 border-2 border-link">
          <p>
            <span className="font-semibold">{inv.invitedBy?.name || inv.invitedBy?.email || 'Кто-то'}</span> приглашает вас
            вести общий дневник сна{inv.realm?.name ? ` («${inv.realm.name.replace(/^Профиль: /, '')}»)` : ''}.
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost flex-1 text-sm"
              disabled={busy === inv.id}
              onClick={async () => {
                setBusy(inv.id);
                await inv.reject().finally(() => setBusy(null));
              }}
            >
              Отклонить
            </button>
            <button
              className="btn-primary flex-1 text-sm"
              disabled={busy === inv.id}
              onClick={async () => {
                setBusy(inv.id);
                await inv.accept().finally(() => setBusy(null));
              }}
            >
              Принять
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
