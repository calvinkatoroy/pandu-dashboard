import type { Incident } from '../lib/types';
import type { VestWithData } from '../hooks/useVestData';
import { wib, ago } from '../lib/format';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Props {
  vests: VestWithData[];
  muted: boolean;
  onMute: () => void;
  onDismiss: (incidentId: number, vestId: number, notes?: string) => void;
  onAck: (incidentId: number) => void;
  now: number;
}

export default function AlarmBanner({ vests, muted, onMute, onDismiss, onAck, now }: Props) {
  const { user } = useAuth();
  const dangerVests = vests.filter(v => v.incident && !v.incident.resolved_at);

  if (dangerVests.length === 0) return null;

  const canAct = user && (user.role === 'operator' || user.role === 'admin');

  return (
    <div className="border-b border-alert/30 bg-alert/10">
      {dangerVests.map(v => {
        const inc = v.incident!;
        const sinceMs = now - new Date(inc.opened_at).getTime();
        const sinceMin = Math.floor(sinceMs / 60000);
        const sinceSec = Math.floor(sinceMs % 60000 / 1000);
        const notAcked = !inc.acknowledged_at;
        const escalating = notAcked && sinceMs > 60_000;

        return (
          <div
            key={inc.id}
            className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${escalating ? 'danger-pulse' : ''}`}
            style={{ background: 'rgba(232,84,43,0.12)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-alert">⚠</span>
              <div>
                <div className="text-sm font-bold text-alert">
                  BAHAYA: {inc.kind} · {v.name}
                </div>
                <div className="font-mono text-xs text-white/50">
                  {wib(inc.opened_at)} WIB · {sinceMin > 0 ? `${sinceMin}m ` : ''}{sinceSec}d lalu
                  {notAcked && escalating && ' · ESKALASI'}
                  {inc.acknowledged_at && ' · di-ack'}
                  {inc.muted_at && ' · dimute'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canAct && (
                <>
                  {notAcked && (
                    <button
                      onClick={() => onAck(inc.id)}
                      className="rounded-lg border border-white/20 bg-ink-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-600"
                    >
                      Ack
                    </button>
                  )}
                  <button
                    onClick={onMute}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      muted ? 'bg-white/10 text-white/40' : 'border border-white/20 bg-ink-700 text-white hover:bg-ink-600'
                    }`}
                  >
                    {muted ? '🔇 Muted' : '🔇 Mute'}
                  </button>
                  <button
                    onClick={() => {
                      const notes = prompt('Catatan singkat (opsional):') ?? '';
                      onDismiss(inc.id, v.id, notes);
                    }}
                    className="rounded-lg bg-alert px-3 py-1.5 text-xs font-semibold text-white hover:bg-alert/90"
                  >
                    Selesai
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
