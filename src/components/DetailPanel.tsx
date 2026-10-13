import type { VestWithData } from '../hooks/useVestData';
import { STAGE_META, batPercent, batColor, helmLabel, rssiBars, rssiLabel } from '../lib/stage';
import { wib, wibDate, ago, coord } from '../lib/format';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { VestEvent } from '../lib/types';

interface Props {
  vest: VestWithData;
  now: number;
  simMode: boolean;
}

export default function DetailPanel({ vest, now, simMode }: Props) {
  const navigate = useNavigate();
  const s = vest.state;
  const stage = s?.stage ?? 'inactive';
  const meta = STAGE_META[stage];
  const [events, setEvents] = useState<VestEvent[]>([]);
  const bat = batPercent(s?.bat_mv ?? null);
  const bars = rssiBars(s?.rssi ?? null);

  useEffect(() => {
    if (simMode || !s) {
      setEvents([]);
      return;
    }
    supabase
      .from('events')
      .select('*')
      .eq('vest_id', vest.id)
      .order('received_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setEvents((data ?? []) as VestEvent[]));
  }, [vest.id, simMode, s?.last_seen_at]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{ background: meta.bg, borderBottom: `1px solid ${meta.border}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base" style={{ color: meta.color }}>{meta.icon}</span>
            <span className="font-display text-lg tracking-wider" style={{ color: meta.color }}>
              {vest.name}
            </span>
          </div>
          <button
            onClick={() => navigate(`/vest/${vest.id}`)}
            className="font-mono text-[10px] text-white/40 hover:text-white/60"
          >
            buka penuh ›
          </button>
        </div>
        <div className="mt-0.5 text-xs" style={{ color: meta.color }}>{s?.status_text ?? '—'}</div>
        {vest.assigned_to && <div className="mt-0.5 text-xs text-white/40">{vest.assigned_to}</div>}
      </div>

      {/* Position */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-white/30">Posisi</div>
        <div className="font-mono text-sm tabular text-white/80">{coord(s?.lat ?? null, s?.lon ?? null)}</div>
        {s?.pos_fix_at && (
          <div className="mt-0.5 text-xs text-white/40">fix {ago(s.pos_fix_at, now)}</div>
        )}
      </div>

      {/* Telemetry grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5">
        {/* Battery */}
        <div className="bg-ink-800 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30">Baterai</div>
          <div className="font-mono text-lg tabular" style={{ color: batColor(s?.bat_mv ?? null, 3500) }}>
            {bat}%
          </div>
          <div className="text-[10px] text-white/40">{s?.bat_mv ?? '—'} mV</div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full rounded" style={{ width: `${bat}%`, background: batColor(s?.bat_mv ?? null, 3500) }} />
          </div>
        </div>

        {/* Helmet */}
        <div className="bg-ink-800 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30">Helm</div>
          <div className="text-sm font-medium">{helmLabel(s?.helm ?? null)}</div>
          <div className="text-[10px] text-white/40">{vest.helmet_label ?? '—'}</div>
        </div>

        {/* Signal */}
        <div className="bg-ink-800 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30">LoRa</div>
          <div className="font-mono text-sm">{rssiLabel(s?.rssi ?? null)}</div>
          <div className="mt-1 flex items-end gap-0.5">
            {[1,2,3,4,5].map(i => (
              <span key={i} className="w-1 rounded-sm" style={{
                height: `${i * 3}px`,
                background: i <= bars ? 'var(--text)' : 'rgba(244,241,234,0.15)',
              }} />
            ))}
          </div>
        </div>

        {/* SNR */}
        <div className="bg-ink-800 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30">SNR</div>
          <div className="font-mono text-sm">{s?.snr != null ? `${s.snr.toFixed(1)} dB` : '—'}</div>
        </div>
      </div>

      {/* Last seen */}
      <div className="border-b border-white/5 px-4 py-2">
        <div className="text-[10px] uppercase tracking-wider text-white/30">Terakhir terdengar</div>
        <div className="text-sm">{ago(s?.last_seen_at ?? null, now)}</div>
      </div>

      {/* Timeline */}
      <div className="flex-1 px-4 py-3">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Linimasa terbaru</div>
        {events.length > 0 ? (
          <div className="space-y-1.5">
            {events.map(e => (
              <div key={e.id} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-12 text-white/40">{wib(e.received_at)}</span>
                <span className="w-8 font-bold" style={{
                  color: ['SOS','FALL','MOB'].includes(e.type) ? 'var(--alert)' : e.type === 'OFF' ? 'var(--text-muted)' : 'var(--text)'
                }}>{e.type}</span>
                <span className="text-white/40">bat {e.bat_mv} · helm {e.helm} · {e.rssi}dBm</span>
              </div>
            ))}
          </div>
        ) : simMode ? (
          <p className="text-xs text-white/30">Data simulator — linimasa tidak tersimpan</p>
        ) : (
          <p className="text-xs text-white/30">Belum ada event</p>
        )}
      </div>
    </div>
  );
}
