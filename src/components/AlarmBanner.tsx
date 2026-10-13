import { useState } from 'react';
import type { VestWithData } from '../hooks/useVestData';
import { wib } from '../lib/format';

interface Props {
  vests: VestWithData[];
  isMuted: (incidentId: number) => boolean;
  canAct: boolean;
  escalationS: number;
  onMute: (incidentId: number, vestId: number) => void;
  onDismiss: (incidentId: number, vestId: number, notes?: string) => void;
  onAck: (incidentId: number, vestId: number) => void;
  now: number;
}

const btn = 'min-h-[44px] rounded-xl px-4 text-sm font-semibold transition';

export default function AlarmBanner({ vests, isMuted, canAct, escalationS, onMute, onDismiss, onAck, now }: Props) {
  const dangerVests = vests.filter(v => v.incident && !v.incident.resolved_at);
  // Catatan penyelesaian: dialog sebaris (menggantikan window.prompt yang memblokir dan jelek di mobile)
  const [closing, setClosing] = useState<number | null>(null);
  const [note, setNote] = useState('');

  if (dangerVests.length === 0) return null;

  return (
    <div role="alert" className="border-b border-alert/40 bg-alert/15">
      {dangerVests.map(v => {
        const inc = v.incident!;
        const sinceMs = now - new Date(inc.opened_at).getTime();
        const sinceMin = Math.floor(sinceMs / 60000);
        const sinceSec = Math.floor((sinceMs % 60000) / 1000);
        const muted = isMuted(inc.id) || !!inc.muted_at;
        const notAcked = !inc.acknowledged_at;
        const escalating = notAcked && sinceMs > escalationS * 1000;

        return (
          <div key={inc.id} className={`px-4 py-3 ${escalating ? 'alarm-ring' : ''}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-alert" aria-hidden>⚠</span>
                <div>
                  <div className="text-base font-bold text-alert">BAHAYA: {inc.kind} · {v.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/70">
                    <span>{wib(inc.opened_at)} WIB</span>
                    <span className="rounded bg-alert px-1.5 py-0.5 font-bold text-ink-900">
                      Durasi {sinceMin > 0 ? `${sinceMin} mnt ` : ''}{sinceSec} dtk
                    </span>
                    {escalating && <b className="text-alert">Belum di-ack</b>}
                    {inc.acknowledged_at && <span>Di-ack</span>}
                    {muted && <span>Suara dimute</span>}
                  </div>
                </div>
              </div>

              {canAct && closing !== inc.id && (
                <div className="flex flex-wrap items-center gap-2">
                  {notAcked && (
                    <button onClick={() => onAck(inc.id, v.id)} className={`${btn} border border-white/25 bg-ink-700 text-white hover:bg-ink-600`}>
                      Saya tangani
                    </button>
                  )}
                  <button
                    onClick={() => onMute(inc.id, v.id)}
                    disabled={muted}
                    className={`${btn} border border-white/25 bg-ink-700 text-white hover:bg-ink-600 disabled:opacity-50`}
                  >
                    {muted ? 'Suara dimute' : 'Matikan suara'}
                  </button>
                  <button onClick={() => { setClosing(inc.id); setNote(''); }} className={`${btn} bg-alert text-ink-900 hover:brightness-110`}>
                    Selesai
                  </button>
                </div>
              )}
            </div>

            {canAct && closing === inc.id && (
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={e => { e.preventDefault(); onDismiss(inc.id, v.id, note.trim()); setClosing(null); }}
              >
                <input
                  autoFocus
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Catatan penanganan (opsional)"
                  aria-label="Catatan penanganan"
                  className="min-h-[44px] flex-1 rounded-xl border border-white/20 bg-ink-900 px-3 text-sm text-white placeholder:text-white/55"
                />
                <button type="submit" className={`${btn} bg-alert text-ink-900 hover:brightness-110`}>Tandai selesai</button>
                <button type="button" onClick={() => setClosing(null)} className={`${btn} border border-white/25 text-white`}>Batal</button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
