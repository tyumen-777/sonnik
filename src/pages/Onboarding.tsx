import { useState } from 'react';
import { addChild } from '../db/repo';
import ChildForm from '../components/ChildForm';
import InvitesBanner from '../components/InvitesBanner';
import { cloudEnabled, login, useCloudUser } from '../db/cloud';

export default function Onboarding() {
  const [busy, setBusy] = useState(false);
  const user = useCloudUser();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <img src="/icons/icon.svg" alt="" className="mb-5 h-16 w-16 rounded-2xl" />
        <h1 className="font-display text-4xl font-semibold tracking-tight">Сонник</h1>
        <p className="mt-3 text-lg leading-relaxed text-fg-muted">
          Дневник сна малыша. Подскажет, когда укладывать, по возрастным рекомендациям AASM, AAP и National Sleep
          Foundation и по ритму вашего ребёнка.
        </p>
      </div>
      <div className="panel">
        <ChildForm
          submitLabel="Начать"
          disabled={busy}
          onSubmit={async (name, birthDate) => {
            setBusy(true);
            await addChild(name, birthDate);
          }}
        />
      </div>
      {cloudEnabled && user?.isLoggedIn ? (
        <div className="mt-6 space-y-3">
          <InvitesBanner />
          <p className="text-sm text-fg-muted">
            Вы вошли как {user.email}. Если профиль уже есть на другом устройстве или вас пригласили, он появится здесь
            после синхронизации.
          </p>
        </div>
      ) : cloudEnabled ? (
        <button className="mt-6 text-sm font-semibold text-link underline underline-offset-4" onClick={login}>
          Уже ведёте дневник на другом устройстве? Войти
        </button>
      ) : (
        <p className="mt-6 text-sm text-fg-muted">Данные хранятся только на этом устройстве.</p>
      )}
    </div>
  );
}
