import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVestData } from '../hooks/useVestData';
import { useAlarmAudio } from '../hooks/useAlarmAudio';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { STAGE_META, effectiveStage } from '../lib/stage';
import { ago } from '../lib/format';
import type { Stage, UserRole } from '../lib/types';
import VestList from '../components/VestList';
import VestHero from '../components/VestHero';
import LiveMap from '../components/LiveMap';
import AlarmBanner from '../components/AlarmBanner';
import DetailPanel from '../components/DetailPanel';
import SimulatorPanel from '../components/SimulatorPanel';

interface Props {
  simMode: boolean;
  role: UserRole | null;
  simFleet: 1 | 8;
  setSimFleet: (f: 1 | 8) => void;
}

export default function MonitorPage({ simMode, role, simFleet, setSimFleet }: Props) {
  const { vests, settings, gateway, loading, realtime, simApply, simUpdateIncident } = useVestData(simMode, simFleet);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const canAct = role === 'operator' || role === 'admin';

  const openIds = useMemo(
    () => vests.filter(v => v.incident && !v.incident.resolved_at).map(v => v.incident!.id),
    [vests],
  );
  const hasDanger = openIds.length > 0;
  const serverMutedIds = useMemo(
    () => vests.filter(v => v.incident && !v.incident.resolved_at && v.incident.muted_at).map(v => v.incident!.id),
    [vests],
  );
  const { enabled, ringing, enableSound, mute, isMuted } = useAlarmAudio(openIds, settings?.alarm_repeat_s ?? 5, serverMutedIds);
  const [sheetOpen, setSheetOpen] = useState(false); // bottom sheet mobile

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-select first danger vest (peta memfokus ke Vest itu)
  useEffect(() => {
    if (loading) return;
    const danger = vests.find(v => v.incident && !v.incident.resolved_at);
    if (danger && selectedId !== danger.id) setSelectedId(danger.id);
    else if ((selectedId === null || !vests.some(v => v.id === selectedId)) && vests.length > 0) {
      const firstActive = vests.find(v => v.state?.stage !== 'inactive');
      setSelectedId(firstActive?.id ?? vests[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIds.join(','), loading, vests.length]);

  const handleMute = useCallback(async (incidentId: number, vestId: number) => {
    mute(incidentId);
    const t = new Date().toISOString();
    if (simMode) { simUpdateIncident(vestId, { muted_at: t }); return; }
    await supabase.from('incidents').update({ muted_at: t }).eq('id', incidentId);
    await logAudit('mute', `incident:${incidentId}`);
  }, [simMode, mute, simUpdateIncident]);

  const handleDismiss = useCallback(async (incidentId: number, vestId: number, notes?: string) => {
    const t = new Date().toISOString();
    if (simMode) {
      simUpdateIncident(vestId, { resolved_at: t, resolution: 'dismissed', notes: notes || null }, true);
      return;
    }
    const uid = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('incidents').update({
      resolved_at: t, resolved_by: uid, resolution: 'dismissed', notes: notes || null,
    }).eq('id', incidentId);
    await logAudit('dismiss', `incident:${incidentId}`);
  }, [simMode, simUpdateIncident]);

  const handleAck = useCallback(async (incidentId: number, vestId: number) => {
    const t = new Date().toISOString();
    if (simMode) { simUpdateIncident(vestId, { acknowledged_at: t, acknowledged_by: 'sim-operator' }); return; }
    const uid = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('incidents').update({ acknowledged_by: uid, acknowledged_at: t }).eq('id', incidentId);
    await logAudit('ack', `incident:${incidentId}`);
  }, [simMode, simUpdateIncident]);

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-white/55">Memuat...</div>;
  }

  const selected = vests.find(v => v.id === selectedId);
  const lowBatMv = settings?.battery_low_mv ?? 3500;
  const hbTimeout = settings?.heartbeat_timeout_s ?? 120;
  const activeVests = vests.filter(v => v.active);
  const single = activeVests.length <= 1;
  const heroVest = single ? (activeVests[0] ?? vests[0]) : null;

  // Ringkasan per stage (heartbeat > timeout dihitung warning di klien juga, sbg pengaman)
  const counts: Record<Stage, number> = { safe: 0, warning: 0, danger: 0, inactive: 0 };
  vests.forEach(v => { counts[effectiveStage(v.state, hbTimeout, now)]++; });
  const gwAge = gateway?.last_seen_at ? (now - new Date(gateway.last_seen_at).getTime()) / 1000 : null;
  const gwOnline = gwAge !== null && gwAge < hbTimeout;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Ringkasan atas (P0) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-ink-900/60 px-4 py-2">
        {(['safe', 'warning', 'danger', 'inactive'] as Stage[]).map(st => (
          <span
            key={st}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{ background: STAGE_META[st].bg, color: STAGE_META[st].color }}
          >
            <span aria-hidden>{STAGE_META[st].icon}</span>
            <span className="tabular">{counts[st]}</span> {STAGE_META[st].label}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-white/70">
          <span className={`h-2 w-2 rounded-full ${gwOnline || simMode ? 'bg-safe' : 'bg-caution'}`} />
          {gateway?.id ?? 'GW'} {gwOnline || simMode ? 'online' : 'tidak ada uplink'}
          {gateway?.last_seen_at && <span className="hidden sm:inline">· {ago(gateway.last_seen_at, now)}</span>}
        </span>
        {!simMode && realtime !== 'online' && (
          <span className="rounded bg-caution/20 px-2 py-0.5 text-[11px] text-caution">
            {realtime === 'offline' ? 'Realtime terputus · data mungkin usang' : 'Menyambung...'}
          </span>
        )}
      </div>

      {!enabled && (
        <div className="flex items-center justify-between border-b border-white/5 bg-ink-800 px-4 py-1.5">
          <span className="text-sm text-white/70">Suara alarm belum aktif</span>
          <button
            id="enable-sound-btn"
            onClick={enableSound}
            className="rounded-lg bg-safe px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:brightness-110"
          >
            Aktifkan suara
          </button>
        </div>
      )}

      <AlarmBanner
        vests={vests}
        isMuted={isMuted}
        canAct={canAct}
        escalationS={settings?.escalation_s ?? 60}
        onMute={handleMute}
        onDismiss={handleDismiss}
        onAck={handleAck}
        now={now}
      />
      {hasDanger && enabled && !ringing && (
        <div className="border-b border-white/5 bg-ink-800 px-4 py-1 text-center text-[11px] text-white/55">
          Suara alarm dimute · insiden tetap terbuka
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {/* Peta full-bleed (acuan: EarthEye) */}
        <div className="absolute inset-0 flex">
          <div className="relative flex-1">
            <LiveMap vests={vests} gateway={gateway} selectedId={selectedId} onSelect={setSelectedId} now={now} heartbeatTimeoutS={hbTimeout} />
            {(simMode || role === 'admin') && (
              <div className="absolute right-3 top-28 z-[1000] lg:bottom-8 lg:top-auto">
                <SimulatorPanel
                  simMode={simMode}
                  vestCount={simMode ? simFleet : 8}
                  onApplyLocal={simApply}
                  fleet={simFleet}
                  onFleetChange={setSimFleet}
                />
              </div>
            )}
          </div>

          {/* Detail Vest terpilih (hanya mode banyak Vest, desktop lebar) */}
          {!single && (
            <div className="hidden w-80 border-l border-white/10 bg-ink-800 xl:block">
              {selected ? (
                <DetailPanel vest={selected} now={now} simMode={simMode} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/55">Pilih Vest untuk detail</div>
              )}
            </div>
          )}
        </div>

        {/* Panel Vest melayang: kiri di desktop, bottom sheet di mobile/tablet */}
        <aside
          aria-label="Status Vest"
          className={`panel absolute inset-x-2 bottom-2 z-[1000] flex flex-col overflow-hidden ${sheetOpen ? 'max-h-[68%]' : 'max-h-[220px]'} lg:inset-x-auto lg:left-3 lg:top-3 lg:max-h-[calc(100%-1.5rem)] ${single ? 'lg:bottom-auto lg:w-[360px]' : 'lg:bottom-3 lg:w-[320px]'}`}
        >
          <button
            onClick={() => setSheetOpen(o => !o)}
            aria-expanded={sheetOpen}
            className="flex min-h-[44px] w-full flex-none items-center justify-center gap-2 text-xs font-semibold text-white/70 lg:hidden"
          >
            <span className="h-1 w-10 rounded-full bg-white/30" aria-hidden />
            {sheetOpen ? 'Ringkas' : 'Lihat rincian'}
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {heroVest ? (
              <VestHero vest={heroVest} now={now} lowBatMv={lowBatMv} heartbeatTimeoutS={hbTimeout} />
            ) : (
              <VestList vests={vests} selectedId={selectedId} onSelect={setSelectedId} now={now} lowBatMv={lowBatMv} heartbeatTimeoutS={hbTimeout} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
