import { Suspense, lazy } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useActiveChild } from './db/repo';
import { useDuplicateCleanup } from './db/cloud';
import LoginDialog from './components/LoginDialog';
import InvitesBanner from './components/InvitesBanner';
import Onboarding from './pages/Onboarding';
import Today from './pages/Today';
import Log from './pages/Log';
import Profile from './pages/Profile';

// Charts are heavy, load them only when the tab is opened.
const Stats = lazy(() => import('./pages/Stats'));

const TABS = [
  { to: '/', label: 'Сегодня', icon: '🌙' },
  { to: '/log', label: 'Журнал', icon: '📖' },
  { to: '/stats', label: 'Статистика', icon: '📊' },
  { to: '/profile', label: 'Профиль', icon: '👶' },
];

export default function App() {
  const { child, loading } = useActiveChild();
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
          <Route path="/profile" element={<Profile child={child} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-ink-700 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs ${isActive ? 'text-moon' : 'text-mist/50'}`
              }
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <LoginDialog />
    </div>
  );
}
