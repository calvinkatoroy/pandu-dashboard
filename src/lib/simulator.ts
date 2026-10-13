import type { EventType, HelmetState, IngestPayload, VestState } from './types';

const BASE = { lat: -6.1033, lon: 106.8817 };

function jitter(base: number, amp: number): number {
  return base + (Math.random() - 0.5) * amp;
}

function mkEvent(
  vest_id: number,
  seq: number,
  type: EventType,
  opts: Partial<{ helm: HelmetState; bat: number; lat: number; lon: number; rssi: number; snr: number }> = {}
) {
  const hasPos = type !== 'OFF' && (opts.lat !== undefined || Math.random() > 0.05);
  return {
    vest_id,
    seq,
    type,
    lat: hasPos ? opts.lat ?? jitter(BASE.lat, 0.004) : null,
    lon: hasPos ? opts.lon ?? jitter(BASE.lon, 0.004) : null,
    pos_age_s: hasPos ? Math.floor(Math.random() * 5) : 0,
    bat_mv: opts.bat ?? 3800 + Math.floor(Math.random() * 200),
    helm: opts.helm ?? 1,
    rssi: opts.rssi ?? -80 + Math.floor(Math.random() * 20),
    snr: opts.snr ?? 6 + Math.random() * 4,
    received_at: new Date().toISOString(),
  };
}

export type Scenario =
  | 'normal' | 'helm_off' | 'offline' | 'sos'
  | 'fall_mob' | 'off' | 'lowbat' | 'nofix';

export function buildSimulatedPayload(scenario: Scenario, vestId = 1): IngestPayload {
  const evs: ReturnType<typeof mkEvent>[] = [];
  switch (scenario) {
    case 'normal':
      for (let s = 0; s < 3; s++) evs.push(mkEvent(vestId, 100 + s, 'HB'));
      break;
    case 'helm_off':
      for (let s = 0; s < 3; s++) evs.push(mkEvent(vestId, 200 + s, 'HB', { helm: 2 }));
      break;
    case 'offline':
      break;
    case 'sos':
      evs.push(mkEvent(vestId, 300, 'SOS'));
      break;
    case 'fall_mob':
      evs.push(mkEvent(vestId, 400, 'FALL'));
      evs.push(mkEvent(vestId, 401, 'MOB'));
      break;
    case 'off':
      evs.push(mkEvent(vestId, 500, 'OFF'));
      break;
    case 'lowbat':
      evs.push(mkEvent(vestId, 600, 'HB', { bat: 3400 }));
      break;
    case 'nofix':
      evs.push(mkEvent(vestId, 700, 'HB', { lat: null, lon: null }));
      break;
  }
  return {
    gateway_id: 'GW1',
    sent_at: new Date().toISOString(),
    events: evs,
  };
}

export function buildVestState(scenario: Scenario, vestId = 1): Partial<VestState> {
  const now = new Date();
  switch (scenario) {
    case 'normal':
      return {
        vest_id: vestId, stage: 'safe', status_text: 'Heartbeat normal',
        lat: jitter(BASE.lat, 0.002), lon: jitter(BASE.lon, 0.002),
        bat_mv: 3890, helm: 1, rssi: -78, snr: 7.2,
        last_seen_at: now.toISOString(), offline: false,
        pos_fix_at: now.toISOString(),
      };
    case 'helm_off':
      return {
        vest_id: vestId, stage: 'warning', status_text: 'Helm tidak terdengar',
        lat: jitter(BASE.lat, 0.002), lon: jitter(BASE.lon, 0.002),
        bat_mv: 3870, helm: 2, rssi: -82, snr: 6.1,
        last_seen_at: now.toISOString(), offline: false,
        pos_fix_at: now.toISOString(),
      };
    case 'offline':
      return {
        vest_id: vestId, stage: 'warning', status_text: 'Tidak terjangkau',
        lat: BASE.lat, lon: BASE.lon, bat_mv: 3850, helm: 1, rssi: null, snr: null,
        last_seen_at: new Date(now.getTime() - 3 * 60_000).toISOString(), offline: true,
        pos_fix_at: new Date(now.getTime() - 3 * 60_000).toISOString(),
      };
    case 'sos':
      return {
        vest_id: vestId, stage: 'danger', status_text: 'SOS aktif',
        lat: jitter(BASE.lat, 0.002), lon: jitter(BASE.lon, 0.002),
        bat_mv: 3880, helm: 1, rssi: -84, snr: 5.5,
        last_seen_at: now.toISOString(), offline: false,
        pos_fix_at: now.toISOString(),
      };
    case 'fall_mob':
      return {
        vest_id: vestId, stage: 'danger', status_text: 'Man Overboard',
        lat: jitter(BASE.lat, 0.003), lon: jitter(BASE.lon, 0.003),
        bat_mv: 3860, helm: 1, rssi: -88, snr: 4.8,
        last_seen_at: now.toISOString(), offline: false,
        pos_fix_at: now.toISOString(),
      };
    case 'off':
      return {
        vest_id: vestId, stage: 'inactive', status_text: 'Vest dimatikan',
        lat: null, lon: null, bat_mv: null, helm: null, rssi: null, snr: null,
        last_seen_at: new Date(now.getTime() - 60_000).toISOString(), offline: true,
        pos_fix_at: null,
      };
    case 'lowbat':
      return {
        vest_id: vestId, stage: 'warning', status_text: 'Baterai rendah',
        lat: jitter(BASE.lat, 0.002), lon: jitter(BASE.lon, 0.002),
        bat_mv: 3400, helm: 1, rssi: -80, snr: 6.0,
        last_seen_at: now.toISOString(), offline: false,
        pos_fix_at: now.toISOString(),
      };
    case 'nofix':
      return {
        vest_id: vestId, stage: 'safe', status_text: 'Posisi belum tersedia',
        lat: null, lon: null, bat_mv: 3880, helm: 1, rssi: -79, snr: 6.8,
        last_seen_at: now.toISOString(), offline: false,
        pos_fix_at: null,
      };
  }
}

export const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: 'normal',   label: 'Normal' },
  { key: 'helm_off', label: 'Helm lepas' },
  { key: 'offline',  label: 'Offline' },
  { key: 'sos',      label: 'SOS' },
  { key: 'fall_mob', label: 'Fall → MOB' },
  { key: 'off',      label: 'Vest OFF' },
  { key: 'lowbat',   label: 'Baterai rendah' },
  { key: 'nofix',    label: 'NOFIX' },
];
