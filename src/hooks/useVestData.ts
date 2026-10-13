import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { VestState, Vest, Incident, Settings, Gateway } from '../lib/types';
import { buildVestState, type Scenario } from '../lib/simulator';

export interface VestWithData extends Vest {
  state: VestState | null;
  incident: Incident | null;
}

export const DEFAULT_SETTINGS: Settings = {
  heartbeat_timeout_s: 120, helmet_threshold_s: 30,
  battery_low_mv: 3500, danger_auto_clear_hb: 2,
  alarm_repeat_s: 5, escalation_s: 60, data_retention_days: 90,
};

const SIM_GATEWAY: Gateway = {
  id: 'GW1', name: 'Dermaga Tanjung Priok',
  lat: -6.1033, lon: 106.8817,
  last_seen_at: new Date().toISOString(),
  status: 'online', sd_ok: true, wifi_ok: true,
};

function emptyState(vestId: number): VestState {
  return {
    vest_id: vestId, offline: true, stage: 'inactive', status_text: null,
    lat: null, lon: null, pos_fix_at: null, bat_mv: null, helm: null,
    rssi: null, snr: null, last_seen_at: null,
  };
}

function simIncident(vestId: number, kind: Incident['kind']): Incident {
  const t = new Date().toISOString();
  return {
    id: Date.now() + vestId, vest_id: vestId, kind, stage: 'danger',
    opened_at: t, last_event_at: t, muted_at: null,
    acknowledged_by: null, acknowledged_at: null,
    resolved_at: null, resolved_by: null, resolution: null, notes: null,
  };
}

/** Riwayat insiden simulator (dipakai halaman Insiden saat mode Sim). */
export const simIncidentHistory: Incident[] = [];

export function useVestData(simMode: boolean, simFleet: 1 | 8 = 1) {
  const [vests, setVests] = useState<Vest[]>([]);
  const [states, setStates] = useState<Record<number, VestState>>({});
  const [incidents, setIncidents] = useState<Record<number, Incident | null>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (simMode) {
      // Simulator: build mock data
      const simStates: Record<number, VestState> = {};
      const simIncidents: Record<number, Incident | null> = {};
      const mockVests: Vest[] = Array.from({ length: simFleet }, (_, i) => ({
        id: i + 1,
        name: `Vest ${String(i + 1).padStart(2, '0')}`,
        assigned_to: i === 0 ? 'Capt. A. Ridwan' : null,
        helmet_label: `Helm A${i + 1}`,
        active: true,
      }));

      const scenarios: Scenario[] = simFleet === 1
        ? ['normal']
        : ['normal', 'normal', 'helm_off', 'sos', 'normal', 'lowbat', 'offline', 'off'];
      mockVests.forEach((v, i) => {
        const s = buildVestState(scenarios[i], v.id);
        simStates[v.id] = { ...emptyState(v.id), ...s } as VestState;
        if (s.stage === 'danger') {
          const inc = simIncident(v.id, s.status_text === 'SOS aktif' ? 'SOS' : 'MOB');
          simIncidents[v.id] = inc;
          simIncidentHistory.unshift(inc);
        }
      });

      setVests(mockVests);
      setStates(simStates);
      setIncidents(simIncidents);
      setSettings(DEFAULT_SETTINGS);
      setGateway({ ...SIM_GATEWAY, last_seen_at: new Date().toISOString() });
      setLoading(false);
      return;
    }

    const [{ data: v }, { data: st }, { data: inc }, { data: set }, { data: gw }] = await Promise.all([
      supabase.from('vests').select('*').order('id'),
      supabase.from('vest_state').select('*'),
      supabase.from('incidents').select('*').is('resolved_at', null),
      supabase.from('settings').select('key, value'),
      supabase.from('gateways').select('*').limit(1).maybeSingle(),
    ]);

    setVests((v ?? []) as Vest[]);

    const stateMap: Record<number, VestState> = {};
    (st ?? []).forEach(s => { stateMap[s.vest_id] = s as VestState; });
    setStates(stateMap);

    const incMap: Record<number, Incident | null> = {};
    (inc ?? []).forEach(i => { incMap[i.vest_id] = i as Incident; });
    setIncidents(incMap);

    const setMap: Record<string, string> = {};
    (set ?? []).forEach(r => { setMap[r.key] = r.value; });
    setSettings({
      heartbeat_timeout_s: parseInt(setMap.heartbeat_timeout_s ?? '120'),
      helmet_threshold_s: parseInt(setMap.helmet_threshold_s ?? '30'),
      battery_low_mv: parseInt(setMap.battery_low_mv ?? '3500'),
      danger_auto_clear_hb: parseInt(setMap.danger_auto_clear_hb ?? '2'),
      alarm_repeat_s: parseInt(setMap.alarm_repeat_s ?? '5'),
      escalation_s: parseInt(setMap.escalation_s ?? '60'),
      data_retention_days: parseInt(setMap.data_retention_days ?? '90'),
    });

    setGateway((gw ?? null) as Gateway | null);
    setLoading(false);
  }, [simMode, simFleet]);

  useEffect(() => { loadData(); }, [loadData]);

  // ---- Simulator actions (lokal, tanpa backend) ----
  const simApply = useCallback((scenario: Scenario, vestId: number) => {
    const s = buildVestState(scenario, vestId);
    setStates(prev => ({ ...prev, [vestId]: { ...emptyState(vestId), ...s } as VestState }));
    setIncidents(prev => {
      const cur = prev[vestId];
      if (s.stage === 'danger') {
        const kind: Incident['kind'] = scenario === 'sos' ? 'SOS' : 'MOB';
        if (cur && !cur.resolved_at) {
          const upd = { ...cur, kind, last_event_at: new Date().toISOString() };
          const h = simIncidentHistory.findIndex(x => x.id === cur.id);
          if (h >= 0) simIncidentHistory[h] = upd;
          return { ...prev, [vestId]: upd };
        }
        const inc = simIncident(vestId, kind);
        simIncidentHistory.unshift(inc);
        return { ...prev, [vestId]: inc };
      }
      // Padam otomatis saat heartbeat normal kembali (insiden tetap tercatat)
      if (cur && !cur.resolved_at && scenario === 'normal') {
        const h = simIncidentHistory.findIndex(x => x.id === cur.id);
        if (h >= 0) simIncidentHistory[h] = { ...cur, resolved_at: new Date().toISOString(), resolution: 'auto' };
        return { ...prev, [vestId]: null };
      }
      return prev;
    });
  }, []);

  const simUpdateIncident = useCallback((vestId: number, patch: Partial<Incident>, close = false) => {
    setIncidents(prev => {
      const cur = prev[vestId];
      if (!cur) return prev;
      const upd = { ...cur, ...patch };
      const h = simIncidentHistory.findIndex(x => x.id === cur.id);
      if (h >= 0) simIncidentHistory[h] = upd;
      return { ...prev, [vestId]: close ? null : upd };
    });
    if (close) {
      setStates(prev => {
        const st = prev[vestId];
        if (!st) return prev;
        return { ...prev, [vestId]: { ...st, stage: 'safe', status_text: 'Heartbeat normal' } };
      });
    }
  }, []);

  // Realtime subscriptions (only when not in sim mode)
  const [realtime, setRealtime] = useState<'online' | 'offline' | 'connecting'>('connecting');
  useEffect(() => {
    if (simMode) return;
    const channel = supabase.channel('vest-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vest_state' },
        (payload) => {
          const ns = payload.new as VestState;
          setStates(prev => ({ ...prev, [ns.vest_id]: ns }));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const gone = payload.old as Partial<Incident>;
            setIncidents(prev => {
              const next = { ...prev };
              for (const k of Object.keys(next)) if (next[+k]?.id === gone.id) next[+k] = null;
              return next;
            });
            return;
          }
          const ni = payload.new as Incident;
          if (ni.resolved_at) {
            setIncidents(prev => {
              const next = { ...prev };
              if (next[ni.vest_id]?.id === ni.id) next[ni.vest_id] = null;
              return next;
            });
          } else {
            setIncidents(prev => ({ ...prev, [ni.vest_id]: ni }));
          }
        })
      .subscribe(status => setRealtime(status === 'SUBSCRIBED' ? 'online' : status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'offline' : 'connecting'));

    return () => { supabase.removeChannel(channel); };
  }, [simMode]);

  const vestsWithData: VestWithData[] = vests.map(v => ({
    ...v,
    state: states[v.id] ?? null,
    incident: incidents[v.id] ?? null,
  }));

  return {
    vests: vestsWithData, settings, gateway, loading, reload: loadData,
    realtime: simMode ? 'online' as const : realtime,
    simApply, simUpdateIncident,
  };
}
