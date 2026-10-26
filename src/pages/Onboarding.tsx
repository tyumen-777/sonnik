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
      <div className="mb-8 text-center">
        <div className="mb-4 text-6xl">🌙</div>
        <h1 className="text-3xl font-bold">Сонник</h1>
        <p className="mt-2 text-mist/70">
          Дневник сна малыша. Подскажем, когда укладывать, по возрастным рекомендациям AASM, AAP и
          National Sleep Foundation.
        </p>
      </div>
      <div className="card">
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
          <p className="text-center text-sm text-mist/60">
            Вы вошли как {user.email}. Если профиль уже есть на другом устройстве или вас пригласили, он появится здесь
            после синхронизации.
          </p>
        </div>
      ) : cloudEnabled ? (
        <button className="mt-6 text-center text-sm text-mist/70 underline underline-offset-4" onClick={login}>
          Уже ведёте дневник на другом устройстве? Войти
        </button>
      ) : (
        <p className="mt-6 text-center text-xs text-mist/40">Данные хранятся только на этом устройстве.</p>
      )}
    </div>
  );
}
