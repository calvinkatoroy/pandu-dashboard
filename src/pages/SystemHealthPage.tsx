import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../lib/supabase';
import type { Gateway, UserRole } from '../lib/types';
import { ago, wib, wibDate, toCSV, downloadCSV } from '../lib/format';
import { PageShell, Card, Notice, Stat, btnGhost } from '../components/ui';

interface Props { simMode: boolean; role: UserRole | null; }

interface AuditRow { id: number; user_id: string | null; action: string; target: string | null; at: string; name?: string }
interface Pt { t: string; rssi: number | null; snr: number | null }

function simData() {
  const now = Date.now();
  const pts: Pt[] = Array.from({ length: 48 }, (_, i) => ({
    t: new Date(now - (47 - i) * 30_000).toISOString(),
    rssi: Math.round(-85 + Math.sin(i / 5) * 6 + (Math.random() - 0.5) * 4),
    snr: +(6 + Math.cos(i / 6) * 2 + (Math.random() - 0.5)).toFixed(1),
  }));
  const audit: AuditRow[] = [
    { id: 3, user_id: null, action: 'dismiss', target: 'incident:2', at: new Date(now - 25 * 60_000).toISOString(), name: 'operator.sim' },
    { id: 2, user_id: null, action: 'ack', target: 'incident:2', at: new Date(now - 29 * 60_000).toISOString(), name: 'operator.sim' },
    { id: 1, user_id: null, action: 'settings_update', target: 'heartbeat_timeout_s=120', at: new Date(now - 3 * 3600_000).toISOString(), name: 'admin.sim' },
  ];
  return { pts, audit, counts: { HB: 2870, SOS: 3, FALL: 1, MOB: 1, OFF: 2 } as Record<string, number> };
}

/** Kesehatan sistem (PLAN §6.4, P1) + audit log (P1). */
export default function SystemHealthPage({ simMode, role }: Props) {
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [now, setNow] = useState(Date.now());
  const canSeeAudit = role === 'admin' || role === 'operator';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (simMode) {
      const d = simData();
      setGateway({ id: 'GW1', name: 'Dermaga Tanjung Priok', lat: -6.1033, lon: 106.8817, last_seen_at: new Date().toISOString(), status: 'online', sd_ok: true, wifi_ok: true });
      setPts(d.pts); setCounts(d.counts); setAudit(d.audit);
      return;
    }
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    (async () => {
      const [{ data: gw }, { data: ev }, { data: au }, { data: prof }] = await Promise.all([
        supabase.from('gateways').select('*').limit(1).maybeSingle(),
        supabase.from('events').select('type, rssi, snr, received_at').gte('received_at', since).order('received_at', { ascending: true }).limit(5000),
        supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(100),
        supabase.from('profiles').select('user_id, name'),
      ]);
      setGateway((gw ?? null) as Gateway | null);
      const c: Record<string, number> = { HB: 0, SOS: 0, FALL: 0, MOB: 0, OFF: 0 };
      (ev ?? []).forEach(e => { c[e.type] = (c[e.type] ?? 0) + 1; });
      setCounts(c);
      setPts((ev ?? []).slice(-200).map(e => ({ t: e.received_at, rssi: e.rssi, snr: e.snr })));
      const names: Record<string, string> = {};
      (prof ?? []).forEach(p => { names[p.user_id] = p.name; });
      setAudit(((au ?? []) as AuditRow[]).map(a => ({ ...a, name: a.user_id ? names[a.user_id] : undefined })));
    })();
  }, [simMode]);

  const gwAgeS = gateway?.last_seen_at ? (now - new Date(gateway.last_seen_at).getTime()) / 1000 : null;
  const gwOnline = simMode || (gwAgeS !== null && gwAgeS < 120);
  const recent = pts.slice(-20).filter(p => p.rssi !== null);
  const avgRssi = recent.length ? Math.round(recent.reduce((a, p) => a + (p.rssi ?? 0), 0) / recent.length) : null;
  const avgSnr = recent.length ? (recent.reduce((a, p) => a + (p.snr ?? 0), 0) / recent.length).toFixed(1) : null;
  const linkQ = avgRssi === null ? '—' : avgRssi >= -80 ? 'Baik' : avgRssi >= -100 ? 'Cukup' : 'Lemah';
  const linkColor = avgRssi === null ? undefined : avgRssi >= -80 ? 'var(--safe)' : avgRssi >= -100 ? 'var(--caution)' : 'var(--alert)';
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <PageShell title="Kesehatan Sistem" subtitle="Gateway, link LoRa, statistik paket 24 jam, dan audit log">
      {simMode && <Notice>Mode Sim: data contoh.</Notice>}

      <Card title="Gateway">
        {gateway ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={gateway.id} value={gwOnline ? 'Online' : 'Offline'} sub={gateway.name} color={gwOnline ? 'var(--safe)' : 'var(--caution)'} />
            <Stat label="Uplink terakhir" value={ago(gateway.last_seen_at, now)} sub={gateway.last_seen_at ? `${wib(gateway.last_seen_at)} WIB` : '—'} />
            <Stat label="microSD" value={gateway.sd_ok ? 'OK' : 'Error'} color={gateway.sd_ok ? 'var(--safe)' : 'var(--alert)'} sub="antrean store-and-forward" />
            <Stat label="WiFi" value={gateway.wifi_ok ? 'OK' : 'Putus'} color={gateway.wifi_ok ? 'var(--safe)' : 'var(--alert)'} />
          </div>
        ) : (
          <p className="text-xs text-white/40">Belum ada Gateway terdaftar.</p>
        )}
      </Card>

      <Card title="Kualitas link LoRa">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label="Kualitas" value={linkQ} color={linkColor} sub="rata-rata 20 paket" />
          <Stat label="RSSI" value={avgRssi !== null ? `${avgRssi} dBm` : '—'} />
          <Stat label="SNR" value={avgSnr !== null ? `${avgSnr} dB` : '—'} />
        </div>
        <div className="h-56">
          {pts.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pts.map(p => ({ ...p, label: wib(p.t) }))}>
                <CartesianGrid stroke="rgba(244,241,234,0.06)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(244,241,234,0.4)', fontSize: 10 }} minTickGap={40} />
                <YAxis yAxisId="r" domain={[-130, -40]} tick={{ fill: 'rgba(244,241,234,0.4)', fontSize: 10 }} width={36} />
                <YAxis yAxisId="s" orientation="right" domain={[-10, 15]} tick={{ fill: 'rgba(244,241,234,0.4)', fontSize: 10 }} width={28} />
                <Tooltip contentStyle={{ background: '#12293d', border: '1px solid rgba(244,241,234,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Line yAxisId="r" type="monotone" dataKey="rssi" name="RSSI (dBm)" stroke="#1fa37a" dot={false} strokeWidth={2} />
                <Line yAxisId="s" type="monotone" dataKey="snr" name="SNR (dB)" stroke="#e0a83e" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-xs text-white/30">Belum ada paket 24 jam terakhir</p>
          )}
        </div>
      </Card>

      <Card title="Paket 24 jam">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat label="Total" value={total} />
          {['HB', 'SOS', 'FALL', 'MOB', 'OFF'].map(t => (
            <Stat key={t} label={t} value={counts[t] ?? 0} color={['SOS', 'FALL', 'MOB'].includes(t) && counts[t] ? 'var(--alert)' : undefined} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          Paket rusak (<code>bad_packet</code>) masih dicatat di serial Gateway saja; belum dikirim ke cloud.
        </p>
      </Card>

      <Card
        title="Audit log"
        right={canSeeAudit && audit.length > 0 && (
          <button
            onClick={() => downloadCSV('pandu-audit.csv', toCSV(audit.map(a => ({ at: a.at, user: a.name ?? a.user_id, action: a.action, target: a.target }))))}
            className={btnGhost}
          >
            CSV
          </button>
        )}
      >
        {!canSeeAudit ? (
          <p className="text-xs text-white/40">Hanya operator/admin yang dapat melihat audit log.</p>
        ) : audit.length === 0 ? (
          <p className="text-xs text-white/30">Belum ada aksi tercatat.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-white/30">
                <tr><th className="py-1.5 pr-3">Waktu</th><th className="pr-3">Pengguna</th><th className="pr-3">Aksi</th><th>Target</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {audit.map(a => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 font-mono text-white/50">{wibDate(a.at)}</td>
                    <td className="pr-3 text-white/70">{a.name ?? a.user_id?.slice(0, 8) ?? '—'}</td>
                    <td className="pr-3"><span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">{a.action}</span></td>
                    <td className="font-mono text-white/50">{a.target ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
