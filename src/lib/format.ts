export function wib(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

export function wibDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}d lalu`;
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`;
  return `${Math.floor(s / 3600)}j lalu`;
}

export function coord(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return 'belum tersedia';
  const f = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;
  return `${f(lat, 'N', 'S')} ${f(lon, 'E', 'W')}`;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
