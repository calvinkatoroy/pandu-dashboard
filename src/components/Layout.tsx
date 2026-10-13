import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { wib } from '../lib/format';
import type { AuthUser } from '../hooks/useAuth';

interface LayoutProps {
  simMode: boolean;
  setSimMode: (v: boolean) => void;
  user: AuthUser | null;
  onSignOut: () => void;
  children: ReactNode;
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ICONS: Record<string, ReactNode> = {
  map: <svg viewBox="0 0 24 24" className="h-5 w-5" {...P}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>,
  log: <svg viewBox="0 0 24 24" className="h-5 w-5" {...P}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
  alert: <svg viewBox="0 0 24 24" className="h-5 w-5" {...P}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>,
  pulse: <svg viewBox="0 0 24 24" className="h-5 w-5" {...P}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  vest: <svg viewBox="0 0 24 24" className="h-5 w-5" {...P}><path d="M8 3 4 6v15h6v-6h4v6h6V6l-4-3-2 4h-4L8 3Z" /></svg>,
  gear: <svg viewBox="0 0 24 24" className="h-5 w-5" {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>,
  logout: <svg viewBox="0 0 24 24" className="h-5 w-5" {...P}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
};

const NAV = [
  { to: '/', label: 'Peta', icon: 'map' },
  { to: '/log', label: 'Log', icon: 'log' },
  { to: '/incidents', label: 'Insiden', icon: 'alert' },
  { to: '/system', label: 'Sistem', icon: 'pulse' },
  { to: '/admin', label: 'Vest', icon: 'vest' },
  { to: '/settings', label: 'Setelan', icon: 'gear' },
];

export default function Layout({ simMode, setSimMode, user, onSignOut, children }: LayoutProps) {
  const [now, setNow] = useState(new Date().toISOString());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-ink-900">
      {/* Top status bar */}
      <header className="flex items-center justify-between border-b border-white/5 bg-ink-900/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl tracking-wider">
            PAN<span className="text-safe">DU</span>
          </span>
          <span className="hidden text-xs text-white/40 sm:inline">Pilot Safety Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="sim-mode-toggle"
            onClick={() => setSimMode(!simMode)}
            title={simMode ? 'Data simulator lokal' : 'Data live dari Supabase'}
            className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              simMode ? 'border-caution/40 bg-caution/10 text-caution' : 'border-safe/40 bg-safe/10 text-safe'
            }`}
          >
            ● {simMode ? 'Sim' : 'Live'}
          </button>
          <div className="font-mono text-xs tabular text-white/50">{wib(now)} WIB</div>
          {user && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-xs text-white/60">{user.name}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/50">{user.role}</span>
            </div>
          )}
          {user && (
            <button id="signout-btn" onClick={onSignOut} title="Keluar" className="text-white/40 transition hover:text-white">
              {ICONS.logout}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop/tablet sidebar */}
        <nav className="hidden w-20 flex-col items-center gap-1 border-r border-white/5 py-3 lg:flex">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              id={`nav-${item.icon}`}
              className={({ isActive }) =>
                `flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-all ${
                  isActive ? 'bg-safe/15 text-safe' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                }`
              }
            >
              {ICONS[item.icon]}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Bottom navigation (mobile/tablet) */}
      <nav className="flex items-center justify-around border-t border-white/5 bg-ink-900 px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-safe' : 'text-white/40'
              }`
            }
          >
            {ICONS[item.icon]}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
