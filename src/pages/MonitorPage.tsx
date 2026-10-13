import { useState, useEffect, useCallback } from 'react';
import { useVestData } from '../hooks/useVestData';
import { useAlarmAudio } from '../hooks/useAlarmAudio';
import { supabase } from '../lib/supabase';
import VestList from '../components/VestList';
import LiveMap from '../components/LiveMap';
import AlarmBanner from '../components/AlarmBanner';
import DetailPanel from '../components/DetailPanel';
import SimulatorPanel from '../components/SimulatorPanel';

interface Props {
  simMode: boolean;
}

export default function MonitorPage({ simMode }: Props) {
  const { vests, settings, gateway, loading } = useVestData(simMode);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [panelMode, setPanelMode] = useState<'detail' | 'sim' | null>(null);

  const hasDanger = vests.some(v => v.incident && !v.incident.resolved_at);
  const { enabled, muted, enableSound, mute, unmute } = useAlarmAudio(hasDanger);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-select first danger vest
  useEffect(() => {
    if (!loading) {
      const danger = vests.find(v => v.incident && !v.incident.resolved_at);
      if (danger && selectedId !== danger.id) {
        setSelectedId(danger.id);
      } else if (selectedId === null && vests.length > 0) {
        const firstActive = vests.find(v => v.state?.stage !== 'inactive');
        setSelectedId(firstActive?.id ?? vests[0]?.id ?? null);
      }
    }
  }, [vests, loading, selectedId]);

  const handleDismiss = useCallback(async (incidentId: number, vestId: number, notes?: string) => {
    if (simMode) {
      // In sim mode, just clear locally (no backend)
      return;
    }
    await supabase.from('incidents').update({
      resolved_at: new Date().toISOString(),
      resolved_by: (await supabase.auth.getUser()).data.user?.id,
      resolution: 'dismissed',
      notes: notes ?? null,
    }).eq('id', incidentId);
    await supabase.from('audit_log').insert({
      action: 'dismiss',
      target: `incident:${incidentId}`,
    });
  }, [simMode]);

  const handleAck = useCallback(async (incidentId: number) => {
    if (simMode) return;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('incidents').update({
      acknowledged_by: uid,
      acknowledged_at: new Date().toISOString(),
    }).eq('id', incidentId);
    await supabase.from('audit_log').insert({
      action: 'ack',
      target: `incident:${incidentId}`,
    });
  }, [simMode]);

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-white/30">Memuat...</div>;
  }

  const selected = vests.find(v => v.id === selectedId);
  const lowBatMv = settings?.battery_low_mv ?? 3500;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sound enable prompt */}
      {!enabled && (
        <div className="flex items-center justify-between border-b border-white/5 bg-ink-800 px-4 py-2">
          <span className="text-xs text-white/50">Aktifkan suara alarm untuk notifikasi Danger</span>
          <button
            onClick={enableSound}
            className="rounded-lg bg-safe px-3 py-1 text-xs font-semibold text-white"
          >
            Aktifkan
          </button>
        </div>
      )}

      {/* Muted indicator */}
      {enabled && muted && !hasDanger && (
        <button
          onClick={unmute}
          className="border-b border-white/5 bg-caution/10 px-4 py-1.5 text-center text-xs text-caution"
        >
          Suara dimute · klik untuk unmute
        </button>
      )}

      <AlarmBanner
        vests={vests}
        muted={muted}
        onMute={mute}
        onDismiss={handleDismiss}
        onAck={handleAck}
        now={now}
      />

      {/* Desktop: 3-panel; Tablet/Mobile: handled by responsive */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Left panel: Vest list */}
        <div className="w-full border-b border-white/5 lg:w-64 lg:border-b-0 lg:border-r">
          <VestList
            vests={vests}
            selectedId={selectedId}
            onSelect={setSelectedId}
            now={now}
            lowBatMv={lowBatMv}
          />
        </div>

        {/* Center: Map */}
        <div className="relative flex-1" style={{ minHeight: '300px' }}>
          <LiveMap
            vests={vests}
            gateway={gateway}
            selectedId={selectedId}
            onSelect={setSelectedId}
            now={now}
          />
          {/* Simulator panel toggle */}
          {simMode && (
            <div className="absolute right-3 top-3 z-[1000]">
              <SimulatorPanel />
            </div>
          )}
        </div>

        {/* Right panel: Detail or empty */}
        <div className="hidden w-80 border-l border-white/5 xl:block">
          {selected ? (
            <DetailPanel vest={selected} now={now} simMode={simMode} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-white/30">
              Pilih Vest untuk detail
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet for selected vest */}
      {selected && (
        <div className="border-t border-white/5 bg-ink-800 px-4 py-3 lg:hidden xl:hidden">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold">{selected.name}</span>
            <span className="text-xs text-white/40">{selected.state?.status_text}</span>
          </div>
          <div className="flex gap-3 text-xs text-white/50">
            <span>Baterai: {selected.state ? Math.round(((selected.state.bat_mv ?? 3000) - 3000) / 13) : 0}%</span>
            <span>Helm: {selected.state?.helm === 1 ? 'Dipakai' : selected.state?.helm === 0 ? 'Jauh' : 'Tidak terdengar'}</span>
            <span>RSSI: {selected.state?.rssi ?? '—'} dBm</span>
          </div>
        </div>
      )}
    </div>
  );
}
