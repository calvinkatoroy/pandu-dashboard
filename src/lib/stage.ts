import type { EventType, HelmetState, Stage } from './types';

export const STAGE_META: Record<
  Stage,
  { label: string; color: string; bg: string; icon: string; border: string }
> = {
  safe:     { label: 'Aman',     color: '#1fa37a', bg: 'rgba(31,163,122,0.16)',  icon: '●', border: 'rgba(31,163,122,0.35)' },
  warning:  { label: 'Warning',  color: '#e0a83e', bg: 'rgba(224,168,62,0.16)',  icon: '▲', border: 'rgba(224,168,62,0.35)' },
  danger:   { label: 'Bahaya',   color: '#e8542b', bg: 'rgba(232,84,43,0.18)',   icon: '⚠', border: 'rgba(232,84,43,0.45)' },
  inactive: { label: 'Nonaktif', color: '#6b7c8d', bg: 'rgba(107,124,141,0.18)', icon: '○', border: 'rgba(107,124,141,0.35)' },
};

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
  if (mv === null) return '#6b7c8d';
  if (mv < lowMv) return '#e8542b';
  if (mv < lowMv + 200) return '#e0a83e';
  return '#1fa37a';
}

export interface StageInput {
  type: EventType;
  helm: HelmetState | null;
  bat_mv: number | null;
  lastSeenSecondsAgo: number;
  hasOpenDanger: boolean;
  settings: { heartbeat_timeout_s: number; helmet_threshold_s: number; battery_low_mv: number };
}

export function computeStage(i: StageInput): Stage {
  if (i.type === 'OFF') return 'inactive';
  if (i.hasOpenDanger) return 'danger';
  if (i.lastSeenSecondsAgo > i.settings.heartbeat_timeout_s) return 'warning';
  if (i.helm !== null && i.helm !== 1) return 'warning';
  if (i.bat_mv !== null && i.bat_mv < i.settings.battery_low_mv) return 'warning';
  return 'safe';
}

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
