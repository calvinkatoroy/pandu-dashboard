import type { VestWithData } from '../hooks/useVestData';
import { STAGE_META, batPercent, batColor, helmLabel, rssiBars, rssiLabel } from '../lib/stage';
import { ago } from '../lib/format';
import { useNavigate } from 'react-router-dom';

interface Props {
  vest: VestWithData;
  selected: boolean;
  onClick: () => void;
  now: number;
  lowBatMv: number;
}

export default function VestCard({ vest, selected, onClick, now, lowBatMv }: Props) {
  const navigate = useNavigate();
  const s = vest.state;
  const stage = s?.stage ?? 'inactive';
  const meta = STAGE_META[stage];
  const bat = batPercent(s?.bat_mv ?? null);
  const bars = rssiBars(s?.rssi ?? null);

  return (
    <button
      onClick={() => { onClick(); navigate(`/vest/${vest.id}`); }}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        selected ? 'ring-1 ring-safe/30' : ''
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
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      {/* Assigned person */}
      {vest.assigned_to && (
        <p className="mt-1.5 truncate text-xs text-white/40">{vest.assigned_to}</p>
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
            <span className="font-mono text-[10px] text-white/50 tabular">{bat}%</span>
          </div>

          {/* Helmet */}
          <span className="text-[10px] text-white/40">{helmLabel(s.helm)}</span>

          {/* Signal */}
          <div className="ml-auto flex items-center gap-1">
            <div className="flex items-end gap-0.5">
              {[1,2,3,4,5].map(i => (
                <span
                  key={i}
                  className="w-0.5 rounded-sm"
                  style={{
                    height: `${i * 3}px`,
                    background: i <= bars ? 'var(--text)' : 'rgba(244,241,234,0.15)',
                  }}
                />
              ))}
            </div>
            <span className="font-mono text-[9px] text-white/40">{rssiLabel(s.rssi)}</span>
          </div>
        </div>
      )}

      {/* Last seen */}
      {s?.last_seen_at && (
        <p className="mt-1.5 font-mono text-[9px] text-white/30">
          {vest.incident ? '⚠ ' : ''}terakhir {ago(s.last_seen_at, now)}
        </p>
      )}
    </button>
  );
}
