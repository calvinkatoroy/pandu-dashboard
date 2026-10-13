import { describe, it, expect } from 'vitest';
import { wib, ago, coord, toCSV } from './format';

describe('Format helpers', () => {
  it('formats UTC ISO time to WIB timezone (UTC+7)', () => {
    // 2026-10-17T03:21:05Z is 10:21:05 WIB
    const iso = '2026-10-17T03:21:05Z';
    const formatted = wib(iso);
    expect(formatted).toContain('10.21.05');
  });

  it('formats elapsed time', () => {
    const now = Date.now();
    const tenSecAgo = new Date(now - 10_000).toISOString();
    const twoMinAgo = new Date(now - 120_000).toISOString();
    const twoHoursAgo = new Date(now - 7_200_000).toISOString();

    expect(ago(tenSecAgo, now)).toBe('10d lalu');
    expect(ago(twoMinAgo, now)).toBe('2m lalu');
    expect(ago(twoHoursAgo, now)).toBe('2j lalu');
    expect(ago(null, now)).toBe('—');
  });

  it('formats geographic coordinates', () => {
    expect(coord(-6.1033, 106.8817)).toBe('6.1033°S 106.8817°E');
    expect(coord(null, null)).toBe('belum tersedia');
  });

  it('generates CSV with proper quotes escaping', () => {
    const rows = [
      { id: 1, name: 'Vest 01', note: 'Normal, ok' },
      { id: 2, name: 'Vest "Special"', note: 'Danger line' },
    ];
    const csv = toCSV(rows);
    expect(csv).toContain('id,name,note');
    expect(csv).toContain('"Normal, ok"');
    expect(csv).toContain('"Vest ""Special"""');
  });
});
