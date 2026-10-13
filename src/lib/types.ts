export type EventType = 'HB' | 'SOS' | 'FALL' | 'MOB' | 'OFF';
export type Stage = 'safe' | 'warning' | 'danger' | 'inactive';
export type HelmetState = 0 | 1 | 2;
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface VestEvent {
  id?: number;
  gateway_id: string;
  vest_id: number;
  seq: number;
  type: EventType;
  lat: number | null;
  lon: number | null;
  pos_age_s: number | null;
  bat_mv: number | null;
  helm: HelmetState | null;
  rssi: number | null;
  snr: number | null;
  received_at: string;
}

export interface VestState {
  vest_id: number;
  stage: Stage;
  status_text: string | null;
  lat: number | null;
  lon: number | null;
  pos_fix_at: string | null;
  bat_mv: number | null;
  helm: HelmetState | null;
  rssi: number | null;
  snr: number | null;
  last_seen_at: string | null;
  offline: boolean;
}

export interface Vest {
  id: number;
  name: string;
  assigned_to: string | null;
  helmet_label: string | null;
  active: boolean;
}

export interface Incident {
  id: number;
  vest_id: number;
  kind: 'SOS' | 'FALL' | 'MOB';
  stage: Stage;
  opened_at: string;
  last_event_at: string;
  muted_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: 'auto' | 'dismissed' | null;
  notes: string | null;
  vest_name?: string;
}

export interface Settings {
  heartbeat_timeout_s: number;
  helmet_threshold_s: number;
  battery_low_mv: number;
  danger_auto_clear_hb: number;
  alarm_repeat_s: number;
  escalation_s: number;
  data_retention_days: number;
}

export interface Gateway {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  last_seen_at: string | null;
  status: string | null;
  sd_ok: boolean;
  wifi_ok: boolean;
}

export interface IngestPayload {
  gateway_id: string;
  sent_at: string;
  events: Array<{
    vest_id: number;
    seq: number;
    type: EventType;
    lat: number | null;
    lon: number | null;
    pos_age_s: number;
    bat_mv: number;
    helm: HelmetState;
    rssi: number;
    snr: number;
    received_at: string;
  }>;
}
