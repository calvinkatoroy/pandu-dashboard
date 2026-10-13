import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { VestState, Vest, Incident, Settings, Gateway } from '../lib/types';
import { buildVestState, type Scenario } from '../lib/simulator';

export interface VestWithData extends Vest {
  state: VestState | null;
  incident: Incident | null;
}

export function useVestData(simMode: boolean) {
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
      const mockVests: Vest[] = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        name: `Vest ${String(i + 1).padStart(2, '0')}`,
        assigned_to: i === 0 ? 'Capt. A. Ridwan' : null,
        helmet_label: `Helm A${i + 1}`,
        active: true,
      }));

      const scenarios: Scenario[] = ['normal', 'normal', 'helm_off', 'sos', 'normal', 'lowbat', 'offline', 'off'];
      mockVests.forEach((v, i) => {
        const s = buildVestState(scenarios[i], v.id);
        simStates[v.id] = { vest_id: v.id, offline: true, stage: 'inactive', status_text: null, lat: null, lon: null, pos_fix_at: null, bat_mv: null, helm: null, rssi: null, snr: null, last_seen_at: null, ...s } as VestState;
        if (s.stage === 'danger') {
          simIncidents[v.id] = {
            id: 9000 + v.id,
            vest_id: v.id,
            kind: s.status_text === 'SOS aktif' ? 'SOS' : 'MOB',
            stage: 'danger',
            opened_at: new Date().toISOString(),
            last_event_at: new Date().toISOString(),
            muted_at: null,
            acknowledged_by: null,
            acknowledged_at: null,
            resolved_at: null,
            resolved_by: null,
            resolution: null,
            notes: null,
          };
        }
      });

      setVests(mockVests);
      setStates(simStates);
      setIncidents(simIncidents);
      setSettings({
        heartbeat_timeout_s: 120, helmet_threshold_s: 30,
        battery_low_mv: 3500, danger_auto_clear_hb: 2,
        alarm_repeat_s: 5, escalation_s: 60, data_retention_days: 90,
      });
      setGateway({
        id: 'GW1', name: 'Dermaga Tanjung Priok',
        lat: -6.1033, lon: 106.8817,
        last_seen_at: new Date().toISOString(),
        status: 'online', sd_ok: true, wifi_ok: true,
      });
      setLoading(false);
      return;
    }

    const [{ data: v }, { data: st }, { data: inc }, { data: set }, { data: gw }] = await Promise.all([
      supabase.from('vests').select('*').order('id'),
      supabase.from('vest_state').select('*'),
      supabase.from('incidents').select('*').is('resolved_at', null),
      supabase.from('settings').select('key, value'),
      supabase.from('gateways').select('*').limit(1).single(),
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

    setGateway(gw as Gateway);
    setLoading(false);
  }, [simMode]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscriptions (only when not in sim mode)
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [simMode]);

  const vestsWithData: VestWithData[] = vests.map(v => ({
    ...v,
    state: states[v.id] ?? null,
    incident: incidents[v.id] ?? null,
  }));

  return { vests: vestsWithData, settings, gateway, loading, reload: loadData };
}
