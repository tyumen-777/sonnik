import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;
  if (event) {
    return (
      <button
        className="btn-primary w-full"
        onClick={async () => {
          await event.prompt();
          if ((await event.userChoice).outcome === 'accepted') setInstalled(true);
          setEvent(null);
        }}
      >
        📲 Установить приложение
      </button>
    );
  }
  if (isIos()) {
    return (
      <p className="text-sm text-fg-muted">
        Чтобы установить приложение, нажмите «Поделиться» в Safari и выберите «На экран „Домой“».
      </p>
    );
  }
  return null;
}
