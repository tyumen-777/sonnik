import { Suspense, lazy } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useActiveChild } from './db/repo';
import { useDuplicateCleanup } from './db/cloud';
import LoginDialog from './components/LoginDialog';
import InvitesBanner from './components/InvitesBanner';
import Icon, { type IconName } from './components/Icon';
import { useTheme } from './lib/theme';
import Onboarding from './pages/Onboarding';
import Today from './pages/Today';
import Log from './pages/Log';
import Profile from './pages/Profile';

// Charts are heavy, load them only when the tab is opened.
const Stats = lazy(() => import('./pages/Stats'));

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Сегодня', icon: 'today' },
  { to: '/log', label: 'Журнал', icon: 'log' },
  { to: '/stats', label: 'Статистика', icon: 'stats' },
  { to: '/profile', label: 'Профиль', icon: 'profile' },
];

export default function App() {
  const { child, loading } = useActiveChild();
  const [theme, setTheme] = useTheme();
  useDuplicateCleanup(child?.id);
  if (loading) return null;
  if (!child) return (
    <>
      <Onboarding />
      <LoginDialog />
    </>
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 space-y-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
        <InvitesBanner />
        <Routes>
          <Route path="/" element={<Today child={child} />} />
          <Route path="/log" element={<Log child={child} />} />
          <Route path="/stats" element={<Suspense fallback={null}><Stats child={child} /></Suspense>} />
          <Route path="/profile" element={<Profile child={child} theme={theme} onThemeChange={setTheme} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              className={({ isActive }) =>
                `group flex flex-col items-center gap-1 pt-2 pb-2.5 text-xs font-medium ${isActive ? 'text-fg' : 'text-fg-faint'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`rounded-full px-4 py-1 transition-colors ${isActive ? 'bg-info-soft text-link' : ''}`}>
                    <Icon name={t.icon} />
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <LoginDialog />
    </div>
  );
}
