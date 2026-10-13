import type { ReactNode } from 'react';

export function PageShell({ title, subtitle, actions, children }: {
  title: string; subtitle?: string; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3 sm:px-6">
        <div>
          <h1 className="font-display text-2xl leading-none tracking-wider">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-white/40">{subtitle}</p>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-ink-800/80 p-4 shadow-lg shadow-black/10">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  const cls = tone === 'warn'
    ? 'border-caution/30 bg-caution/10 text-caution'
    : 'border-white/10 bg-white/5 text-white/60';
  return <div className={`rounded-xl border px-3 py-2 text-xs ${cls}`}>{children}</div>;
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl bg-ink-900/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/30">{label}</div>
      <div className="mt-0.5 font-mono text-lg tabular" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-safe/50 focus:outline-none disabled:opacity-50';
export const btnPrimary =
  'rounded-lg bg-safe px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50';
export const btnGhost =
  'rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-xs text-white/70 transition hover:bg-ink-700 disabled:opacity-50';
