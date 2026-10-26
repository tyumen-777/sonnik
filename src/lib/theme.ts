import { useEffect, useState } from 'react';

export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Per-device preference; storage may be unavailable (private mode), then "auto" is used. */
export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Puts the resolved theme on <html> and colours the phone's status bar to match. */
export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'auto' && media().matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#151b36' : '#eef2f8');
}

export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  useEffect(() => {
    applyTheme(choice);
    if (choice !== 'auto') return;
    const m = media();
    const onChange = () => applyTheme('auto');
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [choice]);
  return [
    choice,
    (t) => {
      try {
        localStorage.setItem(KEY, t);
      } catch {
        // Not persisted; still applied for this session.
      }
      setChoice(t);
    },
  ];
}
