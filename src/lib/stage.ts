import type { HelmetState, Stage } from './types';

export const STAGE_META: Record<
  Stage,
  { label: string; color: string; bg: string; icon: string; border: string }
> = {
  safe:     { label: 'Aman',     color: '#79b99c', bg: 'rgba(121,185,156,0.16)',  icon: '●', border: 'rgba(121,185,156,0.35)' },
  warning:  { label: 'Warning',  color: '#e6b04b', bg: 'rgba(230,176,75,0.16)',  icon: '▲', border: 'rgba(230,176,75,0.35)' },
  danger:   { label: 'Bahaya',   color: '#f2694a', bg: 'rgba(242,105,74,0.18)',   icon: '⚠', border: 'rgba(242,105,74,0.45)' },
  inactive: { label: 'Nonaktif', color: '#8794a1', bg: 'rgba(135,148,161,0.18)', icon: '○', border: 'rgba(135,148,161,0.35)' },
};

/** Stage yang ditampilkan: Aman dengan heartbeat basi dianggap Warning sampai cron server menyusul. */
export function effectiveStage(
  s: { stage: Stage; last_seen_at: string | null } | null | undefined,
  heartbeatTimeoutS: number,
  now: number,
): Stage {
  const st = s?.stage ?? 'inactive';
  if (st !== 'safe' || !s?.last_seen_at) return st;
  return (now - Date.parse(s.last_seen_at)) / 1000 > heartbeatTimeoutS ? 'warning' : st;
}

export function helmLabel(h: HelmetState | null): string {
  if (h === null) return '—';
  return h === 1 ? 'Dipakai' : h === 0 ? 'Jauh' : 'Tidak terdengar';
}

export function batPercent(mv: number | null): number {
  if (mv === null) return 0;
  const pct = ((mv - 3000) / (4300 - 3000)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function batColor(mv: number | null, lowMv: number): string {
  if (mv === null) return '#8794a1';
  if (mv < lowMv) return '#f2694a';
  if (mv < lowMv + 200) return '#e6b04b';
  return '#79b99c';
}

export { computeStage } from '../../supabase/functions/_shared/stage.ts';
export type { StageInput } from '../../supabase/functions/_shared/stage.ts';

export function rssiBars(rssi: number | null): number {
  if (rssi === null) return 0;
  if (rssi >= -70) return 5;
  if (rssi >= -80) return 4;
  if (rssi >= -90) return 3;
  if (rssi >= -100) return 2;
  if (rssi >= -110) return 1;
  return 0;
}

export function rssiLabel(rssi: number | null): string {
  if (rssi === null) return 'no link';
  return `${rssi} dBm`;
}
