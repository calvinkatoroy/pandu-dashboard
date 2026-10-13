import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Incident } from '../lib/types';
import { wibDate, ago, toCSV, downloadCSV } from '../lib/format';

interface Props {
  simMode: boolean;
}

export default function IncidentPage({ simMode }: Props) {
  const [incidents, setIncidents] = useState<(Incident & { vest_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('all');

  useEffect(() => {
    if (simMode) {
      const mock: (Incident & { vest_name?: string })[] = [
        {
          id: 1, vest_id: 3, kind: 'SOS', stage: 'danger',
          opened_at: new Date(Date.now() - 5 * 60_000).toISOString(),
          last_event_at: new Date(Date.now() - 5 * 60_000).toISOString(),
          muted_at: null, acknowledged_by: null, acknowledged_at: null,
          resolved_at: null, resolved_by: null, resolution: null, notes: null,
          vest_name: 'Vest 03',
        },
        {
          id: 2, vest_id: 4, kind: 'MOB', stage: 'danger',
          opened_at: new Date(Date.now() - 30 * 60_000).toISOString(),
          last_event_at: new Date(Date.now() - 28 * 60_000).toISOString(),
          muted_at: null, acknowledged_by: 'uid-1',
          acknowledged_at: new Date(Date.now() - 29 * 60_000).toISOString(),
          resolved_at: new Date(Date.now() - 25 * 60_000).toISOString(),
          resolved_by: 'uid-1', resolution: 'auto', notes: null,
          vest_name: 'Vest 04',
        },
      ];
      setIncidents(mock);
      setLoading(false);
      return;
    }

    let q = supabase.from('incidents').select('*, vests(name)').order('opened_at', { ascending: false });
    if (filter === 'open') q = q.is('resolved_at', null);
    if (filter === 'resolved') q = q.not('resolved_at', 'is', null);

    q.then(({ data }) => {
      const mapped = (data ?? []).map((i: Record<string, unknown>) => ({
        ...(i as Incident),
        vest_name: (i.vests as { name: string } | null)?.name,
      }));
      setIncidents(mapped);
      setLoading(false);
    });
  }, [simMode, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <div className="flex gap-1.5">
          {(['all', 'open', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                filter === f ? 'bg-ink-700 text-white' : 'text-white/40'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'open' ? 'Aktif' : 'Selesai'}
            </button>
          ))}
        </div>
        <button
          onClick={() => downloadCSV('pandu-incidents.csv', toCSV(incidents.map(i => ({
            id: i.id, vest: i.vest_name, kind: i.kind, opened: i.opened_at,
            resolved: i.resolved_at, resolution: i.resolution, acked: !!i.acknowledged_at,
          }))))}
          className="ml-auto rounded-lg border border-white/10 bg-ink-800 px-3 py-1 text-xs text-white/60 hover:bg-ink-700"
        >
          CSV
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center text-xs text-white/30">Memuat...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center text-xs text-white/30">Tidak ada insiden</div>
        ) : (
          <div className="space-y-2">
            {incidents.map(inc => {
              const open = !inc.resolved_at;
              const durMs = inc.resolved_at
                ? new Date(inc.resolved_at).getTime() - new Date(inc.opened_at).getTime()
                : Date.now() - new Date(inc.opened_at).getTime();
              const durMin = Math.floor(durMs / 60000);

              return (
                <div
                  key={inc.id}
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: open ? 'rgba(232,84,43,0.3)' : 'rgba(244,241,234,0.08)',
                    background: open ? 'rgba(232,84,43,0.08)' : 'var(--ink-800)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                        style={{
                          background: open ? 'var(--alert)' : 'rgba(244,241,234,0.1)',
                          color: open ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {inc.kind}
                      </span>
                      <span className="text-sm font-semibold">{inc.vest_name ?? `Vest ${inc.vest_id}`}</span>
                    </div>
                    <span className="text-xs" style={{ color: open ? 'var(--alert)' : 'var(--text-muted)' }}>
                      {open ? 'AKTIF' : inc.resolution === 'auto' ? 'Auto-selesai' : 'Ditangani'}
                    </span>
                  </div>

                  <div className="mt-2 flex gap-4 font-mono text-[11px] text-white/50">
                    <span>buka: {wibDate(inc.opened_at)}</span>
                    <span>durasi: {durMin}m</span>
                    {inc.acknowledged_at && <span>ack: {ago(inc.acknowledged_at)}</span>}
                  </div>

                  {inc.notes && <p className="mt-1.5 text-xs text-white/60">"{inc.notes}"</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
