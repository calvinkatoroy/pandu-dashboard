import type { VestWithData } from '../hooks/useVestData';
import { STAGE_META, batPercent, batColor, helmLabel, rssiBars, rssiLabel } from '../lib/stage';
import { ago, coord, wib } from '../lib/format';
import { useNavigate } from 'react-router-dom';

interface Props {
  vest: VestWithData;
  now: number;
  lowBatMv: number;
  heartbeatTimeoutS: number;
}

/** Kartu besar untuk mode prototipe 1 Vest (PLAN §1: MVP fokus satu Vest). */
export default function VestHero({ vest, now, lowBatMv, heartbeatTimeoutS }: Props) {
  const navigate = useNavigate();
  const s = vest.state;
  const stage = s?.stage ?? 'inactive';
  const meta = STAGE_META[stage];
  const bat = batPercent(s?.bat_mv ?? null);
  const bars = rssiBars(s?.rssi ?? null);
  const lastS = s?.last_seen_at ? Math.floor((now - new Date(s.last_seen_at).getTime()) / 1000) : null;
  const stale = lastS !== null && lastS > heartbeatTimeoutS && stage !== 'inactive';
  const hbPct = lastS === null ? 0 : Math.min(100, (lastS / heartbeatTimeoutS) * 100);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div
        className={`relative overflow-hidden px-5 py-5 ${stage === 'danger' ? 'danger-pulse' : ''}`}
        style={{ background: `linear-gradient(135deg, ${meta.bg}, transparent 80%)`, borderBottom: `1px solid ${meta.border}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Vest #{vest.id}</div>
            <h2 className="font-display text-4xl leading-none" style={{ color: meta.color }}>{vest.name}</h2>
            {vest.assigned_to && <div className="mt-1 text-sm text-white/60">{vest.assigned_to}</div>}
          </div>
          <div
            className="flex flex-col items-center rounded-2xl px-4 py-2"
            style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
          >
            <span className="text-2xl leading-none" style={{ color: meta.color }} aria-hidden>{meta.icon}</span>
            <span className="mt-1 font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.label}
            </span>
          </div>
        </div>
        <div className="mt-3 text-base font-medium" style={{ color: meta.color }}>
          {stale ? 'Tidak terjangkau / inaktif' : s?.status_text ?? 'Belum ada data'}
          {vest.incident && <span className="ml-2 rounded bg-alert px-1.5 py-0.5 font-mono text-[11px] text-white">{vest.incident.kind}</span>}
        </div>

        {/* Heartbeat timer */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-white/40">
            <span>terakhir terdengar {ago(s?.last_seen_at ?? null, now)}</span>
            <span>timeout {heartbeatTimeoutS}s</span>
          </div>
          <div className="h-1 overflow-hidden rounded bg-white/10">
            <div
              className="h-full rounded transition-all duration-1000"
              style={{ width: `${hbPct}%`, background: hbPct >= 100 ? 'var(--caution)' : 'var(--safe)' }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/5">
        <Tile label="Baterai">
          <div className="font-mono text-2xl tabular" style={{ color: batColor(s?.bat_mv ?? null, lowBatMv) }}>{bat}%</div>
          <div className="text-[11px] text-white/40">{s?.bat_mv ?? '—'} mV</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full rounded" style={{ width: `${bat}%`, background: batColor(s?.bat_mv ?? null, lowBatMv) }} />
          </div>
        </Tile>
        <Tile label="Helm">
          <div className="text-lg font-semibold" style={{ color: s?.helm === 1 ? 'var(--safe)' : s?.helm == null ? undefined : 'var(--caution)' }}>
            {helmLabel(s?.helm ?? null)}
          </div>
          <div className="text-[11px] text-white/40">{vest.helmet_label ?? '—'}</div>
        </Tile>
        <Tile label="Link LoRa">
          <div className="flex items-end gap-2">
            <div className="flex items-end gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className="w-1.5 rounded-sm" style={{
                  height: `${i * 4}px`,
                  background: i <= bars ? 'var(--text)' : 'rgba(244,241,234,0.15)',
                }} />
              ))}
            </div>
            <span className="font-mono text-sm">{rssiLabel(s?.rssi ?? null)}</span>
          </div>
          <div className="mt-1 text-[11px] text-white/40">SNR {s?.snr != null ? `${s.snr.toFixed(1)} dB` : '—'}</div>
        </Tile>
        <Tile label="Posisi">
          <div className="font-mono text-xs tabular text-white/80">{coord(s?.lat ?? null, s?.lon ?? null)}</div>
          <div className="mt-1 text-[11px] text-white/40">
            {s?.pos_fix_at ? `fix ${ago(s.pos_fix_at, now)} · ${wib(s.pos_fix_at)}` : 'posisi belum tersedia'}
          </div>
        </Tile>
      </div>

      <div className="p-4">
        <button
          id={`vest-hero-detail-${vest.id}`}
          onClick={() => navigate(`/vest/${vest.id}`)}
          className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm font-medium text-white/80 transition hover:border-safe/40 hover:bg-ink-700"
        >
          Linimasa, grafik & paket mentah ›
        </button>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-ink-800 px-4 py-3">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/30">{label}</div>
      {children}
    </div>
  );
}
