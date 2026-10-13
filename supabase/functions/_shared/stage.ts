// Logika stage + validasi event: dipakai Edge Function ingest dan client (satu sumber kebenaran).
// Tanpa API Deno/DOM supaya bisa diimpor dari keduanya.
export type Stage = 'safe' | 'warning' | 'danger' | 'inactive';

export interface StageInput {
  type: string;
  helm: number | null;
  bat_mv: number | null;
  lastSeenSecondsAgo: number;
  /** Detik sejak helm terakhir terlihat dipakai (helm=1); 0 bila sedang dipakai. */
  helmOffSeconds?: number;
  hasOpenDanger: boolean;
  settings: { heartbeat_timeout_s: number; helmet_threshold_s: number; battery_low_mv: number };
}

export function computeStage(i: StageInput): Stage {
  if (i.type === 'OFF') return 'inactive';
  if (i.hasOpenDanger) return 'danger';
  if (i.lastSeenSecondsAgo > i.settings.heartbeat_timeout_s) return 'warning';
  if (i.helm !== null && i.helm !== 1 && (i.helmOffSeconds ?? 0) >= i.settings.helmet_threshold_s) return 'warning';
  if (i.bat_mv !== null && i.bat_mv < i.settings.battery_low_mv) return 'warning';
  return 'safe';
}

export const VALID_TYPES = ['HB', 'SOS', 'FALL', 'MOB', 'OFF'];

const isInt = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

export function validateEvent(ev: unknown): string | null {
  if (!ev || typeof ev !== 'object') return 'event is not an object';
  const e = ev as Record<string, unknown>;
  if (typeof e.type !== 'string' || !VALID_TYPES.includes(e.type)) return `invalid type: ${e.type}`;
  if (!isInt(e.vest_id, 1, 8)) return `vest_id out of range: ${e.vest_id}`;
  if (!isInt(e.seq, 0, 65535)) return `seq out of range: ${e.seq}`;
  if (!isInt(e.helm, 0, 2)) return `invalid helm: ${e.helm}`;
  if (!isInt(e.bat_mv, 2500, 4500)) return `bat_mv out of range: ${e.bat_mv}`;
  if (e.lat !== null && !isNum(e.lat, -90, 90)) return 'lat out of range';
  if (e.lon !== null && !isNum(e.lon, -180, 180)) return 'lon out of range';
  if (!isInt(e.rssi, -140, 0)) return `rssi out of range: ${e.rssi}`;
  if (typeof e.received_at !== 'string' || isNaN(Date.parse(e.received_at))) return 'invalid received_at';
  return null;
}
