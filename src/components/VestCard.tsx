import type { VestWithData } from '../hooks/useVestData';
import { STAGE_META, effectiveStage, batPercent, batColor, helmLabel, rssiBars, rssiLabel } from '../lib/stage';
import { ago } from '../lib/format';
import { useNavigate } from 'react-router-dom';

interface Props {
  vest: VestWithData;
  selected: boolean;
  onClick: () => void;
  now: number;
  lowBatMv: number;
  heartbeatTimeoutS: number;
}

export default function VestCard({ vest, selected, onClick, now, lowBatMv, heartbeatTimeoutS }: Props) {
  const navigate = useNavigate();
  const s = vest.state;
  const stage = effectiveStage(s, heartbeatTimeoutS, now);
  const meta = STAGE_META[stage];
  const bat = batPercent(s?.bat_mv ?? null);
  const bars = rssiBars(s?.rssi ?? null);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`group relative w-full cursor-pointer text-left rounded-xl border p-3 transition-all ${
        selected ? 'ring-2 ring-safe/40 shadow-lg shadow-safe/10' : 'hover:border-white/20'
      }`}
      style={{
        borderColor: meta.border,
        background: stage === 'danger' ? meta.bg : 'var(--ink-800)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${stage === 'danger' ? 'danger-pulse' : ''}`}
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.icon}
          </span>
          <span className="text-sm font-semibold">{vest.name}</span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      {/* Assigned person */}
      {vest.assigned_to && (
        <p className="mt-1.5 truncate text-xs text-white/55">{vest.assigned_to}</p>
      )}

      {/* Status text */}
      <p className="mt-0.5 truncate text-xs" style={{ color: meta.color }}>
        {s?.status_text ?? 'Belum ada data'}
      </p>

      {/* Telemetry row */}
      {s && (
        <div className="mt-2.5 flex items-center gap-3">
          {/* Battery */}
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-7 overflow-hidden rounded-sm bg-white/10">
              <div
                className="h-full rounded-sm"
                style={{ width: `${bat}%`, background: batColor(s.bat_mv, lowBatMv) }}
              />
            </div>
            <span className="font-mono text-[11px] text-white/50 tabular">{bat}%</span>
          </div>

          {/* Helmet */}
          <span className="text-[11px] text-white/55">{helmLabel(s.helm)}</span>

          {/* Signal */}
          <div className="ml-auto flex items-center gap-1">
            <div className="flex items-end gap-0.5">
              {[1,2,3,4,5].map(i => (
                <span
                  key={i}
                  className="w-0.5 rounded-sm"
                  style={{
                    height: `${i * 3}px`,
                    background: i <= bars ? 'var(--text)' : 'rgba(236,239,241,0.15)',
                  }}
                />
              ))}
            </div>
            <span className="font-mono text-[11px] text-white/55">{rssiLabel(s.rssi)}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-white/55">
        <span>{s?.last_seen_at ? `${vest.incident ? '⚠ ' : ''}terakhir ${ago(s.last_seen_at, now)}` : '—'}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/vest/${vest.id}`);
          }}
          className="min-h-[32px] px-1 font-sans text-xs text-safe hover:underline"
        >
          Detail ›
        </button>
      </div>
    </div>
  );
}
