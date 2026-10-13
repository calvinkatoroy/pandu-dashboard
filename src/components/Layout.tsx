import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { wib } from '../lib/format';

interface LayoutProps {
  simMode: boolean;
  setSimMode: (v: boolean) => void;
  children: ReactNode;
}

const NAV = [
  { to: '/', label: 'Peta', icon: '地图' },
  { to: '/log', label: 'Log', icon: '日志' },
  { to: '/incidents', label: 'Insiden', icon: '警报' },
  { to: '/system', label: 'Sistem', icon: '齿轮' },
  { to: '/admin', label: 'Vest', icon: '背心' },
  { to: '/settings', label: 'Setelan', icon: '设置' },
];

export default function Layout({ simMode, setSimMode, children }: LayoutProps) {
  const loc = useLocation();
  const [now, setNow] = useState(new Date().toISOString());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-ink-900">
      {/* Top status bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl tracking-wider">
            PAN<span className="text-safe">DU</span>
          </span>
          <span className="hidden text-xs text-white/40 sm:inline">Pilot Safety Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Sim mode toggle */}
          <button
            onClick={() => setSimMode(!simMode)}
            className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border transition-colors ${
              simMode
                ? 'border-safe/40 bg-safe/10 text-safe'
                : 'border-white/10 text-white/50'
            }`}
          >
            {simMode ? '● Sim' : '● Live'}
          </button>
          <div className="font-mono text-xs tabular text-white/50">
            {wib(now)} WIB
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>

      {/* Bottom navigation (mobile/tablet) */}
      <nav className="flex items-center justify-around border-t border-white/5 bg-ink-900 px-2 py-1 lg:hidden">
        {NAV.slice(0, 5).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-safe' : 'text-white/40'
              }`
            }
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Desktop nav indicator */}
      {loc.pathname !== '/' && (
        <div className="hidden lg:block" />
      )}
    </div>
  );
}
