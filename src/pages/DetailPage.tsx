import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Vest, VestEvent, VestState, Incident } from '../lib/types';
import { STAGE_META, batPercent, batColor, helmLabel, rssiBars, rssiLabel } from '../lib/stage';
import { wib, wibDate, ago, coord, toCSV, downloadCSV } from '../lib/format';
import { useVestData } from '../hooks/useVestData';
import { buildVestState, SCENARIOS, type Scenario } from '../lib/simulator';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';

interface Props {
  simMode: boolean;
}

export default function DetailPage({ simMode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vestId = Number(id);
  const { vests } = useVestData(simMode);
  const vest = vests.find(v => v.id === vestId);

  const [events, setEvents] = useState<VestEvent[]>([]);
  const [chartData, setChartData] = useState<{ t: string; bat: number; rssi: number }[]>([]);

  useEffect(() => {
    if (simMode) {
      const now = Date.now();
      const data = Array.from({ length: 48 }, (_, i) => {
        const t = new Date(now - (47 - i) * 30 * 60_000);
        return {
          t: wib(t.toISOString()),
          bat: 3700 + Math.floor(Math.random() * 200),
          rssi: -85 + Math.floor(Math.random() * 15),
        };
      });
      setChartData(data);

      // Generate realistic recent simulated events for this vest
      const mockEvs: VestEvent[] = Array.from({ length: 20 }, (_, i) => {
        const t = new Date(now - i * 30_000).toISOString();
        let evType: VestEvent['type'] = 'HB';
        if (i === 0 && vest?.incident) {
          evType = vest.incident.kind;
        } else if (i === 5 && Math.random() > 0.5) {
          evType = 'HB';
        }
        return {
          id: 5000 + i,
          gateway_id: 'GW1',
          vest_id: vestId,
          seq: 400 - i,
          type: evType,
          lat: vest?.state?.lat ?? -6.1033 + (Math.random() - 0.5) * 0.002,
          lon: vest?.state?.lon ?? 106.8817 + (Math.random() - 0.5) * 0.002,
          pos_age_s: i === 0 ? 3 : (i * 30),
          bat_mv: (vest?.state?.bat_mv ?? 3850) - (i * 2),
          helm: vest?.state?.helm ?? 1,
          rssi: (vest?.state?.rssi ?? -80) + Math.floor((Math.random() - 0.5) * 6),
          snr: (vest?.state?.snr ?? 6.5) + Number(((Math.random() - 0.5) * 2).toFixed(1)),
          received_at: t,
        };
      });
      setEvents(mockEvs);
      return;
    }

    supabase
      .from('events')
      .select('*')
      .eq('vest_id', vestId)
      .order('received_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setEvents((data ?? []) as VestEvent[]);
        const cd = (data ?? [])
          .filter(e => e.bat_mv != null)
          .reverse()
          .map(e => ({
            t: wib(e.received_at),
            bat: e.bat_mv!,
            rssi: e.rssi ?? -120,
          }));
        setChartData(cd);
      });
  }, [vestId, simMode]);

  const s = vest?.state;
  const stage = s?.stage ?? 'inactive';
  const meta = STAGE_META[stage];
  const bat = batPercent(s?.bat_mv ?? null);
  const lowMv = 3500;
  const bars = rssiBars(s?.rssi ?? null);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Back button */}
      <div className="border-b border-white/5 px-4 py-2">
        <button
          onClick={() => navigate('/')}
          className="font-mono text-xs text-white/40 hover:text-white/60"
        >
          ‹ Kembali ke peta
        </button>
      </div>

      {/* Header */}
      <div className="px-4 py-4" style={{ background: meta.bg }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl" style={{ color: meta.color }}>{meta.icon}</span>
          <div>
            <div className="font-display text-2xl tracking-wider" style={{ color: meta.color }}>
              {vest?.name ?? `Vest ${vestId}`}
            </div>
            <div className="text-sm" style={{ color: meta.color }}>{s?.status_text ?? '—'}</div>
          </div>
        </div>
        {vest?.assigned_to && (
          <div className="mt-1.5 text-sm text-white/40">{vest.assigned_to} · {vest.helmet_label}</div>
        )}
      </div>

      {/* Position */}
      <Section title="Posisi">
        <div className="font-mono text-sm tabular text-white/80">{coord(s?.lat ?? null, s?.lon ?? null)}</div>
        {s?.pos_fix_at && <div className="mt-1 text-xs text-white/40">fix {ago(s.pos_fix_at)}</div>}
        {s?.lat != null && (
          <button
            onClick={() => navigator.clipboard.writeText(`${s.lat},${s.lon}`)}
            className="mt-1.5 font-mono text-[10px] text-safe hover:underline"
          >
            salin koordinat
          </button>
        )}
      </Section>

      {/* Telemetry grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
        <Tile label="Baterai" value={`${bat}%`} sub={`${s?.bat_mv ?? '—'} mV`}>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full rounded" style={{ width: `${bat}%`, background: batColor(s?.bat_mv ?? null, lowMv) }} />
          </div>
        </Tile>
        <Tile label="Helm" value={helmLabel(s?.helm ?? null)} sub={vest?.helmet_label ?? '—'} />
        <Tile label="LoRa" value={rssiLabel(s?.rssi ?? null)}>
          <div className="mt-1 flex items-end gap-0.5">
            {[1,2,3,4,5].map(i => (
              <span key={i} className="w-1 rounded-sm" style={{
                height: `${i * 3}px`,
                background: i <= bars ? 'var(--text)' : 'rgba(244,241,234,0.15)',
              }} />
            ))}
          </div>
        </Tile>
        <Tile label="SNR" value={s?.snr != null ? `${s.snr.toFixed(1)} dB` : '—'} />
      </div>

      {/* Charts */}
      <Section title="Baterai 24 jam">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" tick={{ fontSize: 8, fill: 'rgba(244,241,234,0.3)' }} interval={6} />
            <YAxis domain={[3000, 4300]} tick={{ fontSize: 9, fill: 'rgba(244,241,234,0.3)' }} />
            <Tooltip
              contentStyle={{ background: '#12293d', border: '1px solid rgba(244,241,234,0.1)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'rgba(244,241,234,0.5)' }}
            />
            <Line type="monotone" dataKey="bat" stroke="#1fa37a" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section title="RSSI 24 jam">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" tick={{ fontSize: 8, fill: 'rgba(244,241,234,0.3)' }} interval={6} />
            <YAxis domain={[-120, -60]} tick={{ fontSize: 9, fill: 'rgba(244,241,234,0.3)' }} />
            <Tooltip
              contentStyle={{ background: '#12293d', border: '1px solid rgba(244,241,234,0.1)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'rgba(244,241,234,0.5)' }}
            />
            <Line type="monotone" dataKey="rssi" stroke="#e0a83e" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* Timeline */}
      <Section title="Linimasa kejadian (20 terbaru)">
        {events.length > 0 ? (
          <div className="space-y-1">
            {events.map(e => (
              <div key={e.id} className="flex items-center gap-3 border-b border-white/5 py-1.5 font-mono text-xs">
                <span className="w-16 text-white/40">{wib(e.received_at)}</span>
                <span className="w-8 font-bold" style={{
                  color: ['SOS','FALL','MOB'].includes(e.type) ? 'var(--alert)' : e.type === 'OFF' ? 'rgba(244,241,234,0.4)' : 'var(--text)'
                }}>{e.type}</span>
                <span className="text-white/40">bat {e.bat_mv} · helm {e.helm} · {e.rssi}dBm</span>
                <span className="text-white/30">{coord(e.lat, e.lon)}</span>
              </div>
            ))}
          </div>
        ) : simMode ? (
          <p className="text-xs text-white/30">Data simulator — linimasa tidak tersimpan di DB</p>
        ) : (
          <p className="text-xs text-white/30">Belum ada event</p>
        )}
      </Section>

      {/* Export */}
      {events.length > 0 && (
        <div className="px-4 py-3">
          <button
            onClick={() => downloadCSV(
              `vest-${vestId}-events.csv`,
              toCSV(events.map(e => ({
                time: e.received_at, type: e.type, lat: e.lat, lon: e.lon,
                bat_mv: e.bat_mv, helm: e.helm, rssi: e.rssi, snr: e.snr, seq: e.seq,
              })))
            )}
            className="rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-xs text-white/60 hover:bg-ink-700"
          >
            Ekspor CSV
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 px-4 py-3">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-white/30">{title}</div>
      {children}
    </div>
  );
}

function Tile({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-ink-800 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-white/30">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
      {sub && <div className="text-[10px] text-white/40">{sub}</div>}
      {children}
    </div>
  );
}
