import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { VestEvent } from '../lib/types';
import { wibDate, toCSV, downloadCSV } from '../lib/format';

interface Props {
  simMode: boolean;
}

const PAGE_SIZE = 25;

export default function LogPage({ simMode }: Props) {
  const [events, setEvents] = useState<(VestEvent & { vest_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [filterVest, setFilterVest] = useState('all');
  const [search, setSearch] = useState('');
  const [vests, setVests] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    supabase.from('vests').select('id, name').order('id').then(({ data }) => {
      setVests((data ?? []) as { id: number; name: string }[]);
    });
  }, []);

  useEffect(() => {
    if (simMode) {
      // Generate mock log data
      const mock: (VestEvent & { vest_name?: string })[] = [];
      const types = ['HB', 'SOS', 'FALL', 'MOB', 'OFF', 'HB', 'HB', 'HB'];
      for (let i = 0; i < 40; i++) {
        const vid = (i % 8) + 1;
        mock.push({
          id: i, gateway_id: 'GW1', vest_id: vid, seq: 100 + i,
          type: types[i % types.length] as VestEvent['type'],
          lat: -6.1033 + Math.random() * 0.004,
          lon: 106.8817 + Math.random() * 0.004,
          pos_age_s: Math.floor(Math.random() * 10),
          bat_mv: 3700 + Math.floor(Math.random() * 200),
          helm: (i % 5 === 0 ? 2 : 1) as 0 | 1 | 2,
          rssi: -85 + Math.floor(Math.random() * 15),
          snr: 5 + Math.random() * 4,
          received_at: new Date(Date.now() - i * 30_000).toISOString(),
          vest_name: `Vest ${String(vid).padStart(2, '0')}`,
        });
      }
      setEvents(mock);
      setTotal(mock.length);
      setLoading(false);
      return;
    }

    let q = supabase.from('events').select('*', { count: 'exact' });
    if (filterType !== 'all') q = q.eq('type', filterType);
    if (filterVest !== 'all') q = q.eq('vest_id', Number(filterVest));

    q.order('received_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .then(({ data, count }) => {
        setEvents((data ?? []) as (VestEvent & { vest_name?: string })[]);
        setTotal(count ?? 0);
        setLoading(false);
      });
  }, [simMode, page, filterType, filterVest]);

  const filtered = search
    ? events.filter(e =>
        `${e.type} ${e.vest_id} ${e.vest_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className="flex h-full flex-col">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 px-4 py-3">
        <select
          value={filterVest}
          onChange={e => { setFilterVest(e.target.value); setPage(0); }}
          className="rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1.5 text-xs text-white"
        >
          <option value="all">Semua Vest</option>
          {vests.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(0); }}
          className="rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1.5 text-xs text-white"
        >
          <option value="all">Semua jenis</option>
          {['HB', 'SOS', 'FALL', 'MOB', 'OFF'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          placeholder="Cari..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-xs text-white placeholder:text-white/30"
        />
        <button
          onClick={() => downloadCSV('pandu-log.csv', toCSV(filtered.map(e => ({
            time: e.received_at, vest: e.vest_id, type: e.type,
            lat: e.lat, lon: e.lon, bat_mv: e.bat_mv, helm: e.helm,
            rssi: e.rssi, snr: e.snr, seq: e.seq,
          }))))}
          className="ml-auto rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-xs text-white/60 hover:bg-ink-700"
        >
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-xs text-white/30">Memuat...</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-900 text-white/40">
              <tr className="border-b border-white/5">
                <th className="px-3 py-2 text-left font-medium">Waktu</th>
                <th className="px-3 py-2 text-left font-medium">Vest</th>
                <th className="px-3 py-2 text-left font-medium">Jenis</th>
                <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Posisi</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Baterai</th>
                <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Helm</th>
                <th className="hidden px-3 py-2 text-right font-medium md:table-cell">RSSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id ?? `${e.vest_id}-${e.seq}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-white/50">{wibDate(e.received_at)}</td>
                  <td className="px-3 py-2">{e.vest_name ?? `Vest ${e.vest_id}`}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono font-bold" style={{
                      color: ['SOS','FALL','MOB'].includes(e.type) ? 'var(--alert)' : e.type === 'OFF' ? 'rgba(244,241,234,0.4)' : 'var(--text)'
                    }}>{e.type}</span>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-white/40 sm:table-cell">
                    {e.lat != null ? `${e.lat.toFixed(4)},${e.lon?.toFixed(4)}` : 'NOFIX'}
                  </td>
                  <td className="hidden px-3 py-2 text-right font-mono text-white/60 sm:table-cell">{e.bat_mv}</td>
                  <td className="hidden px-3 py-2 text-right font-mono text-white/60 md:table-cell">{e.helm}</td>
                  <td className="hidden px-3 py-2 text-right font-mono text-white/60 md:table-cell">{e.rssi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!simMode && total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-2">
          <span className="text-xs text-white/40">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 disabled:opacity-30"
            >
              ‹
            </button>
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
