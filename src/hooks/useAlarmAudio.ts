import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Alarm suara untuk Danger (PLAN §9):
 * - Web Audio (tanpa file eksternal), bunyi berulang tiap `repeatS` detik sampai di-mute.
 * - Mute per insiden: insiden baru akan berbunyi lagi walau insiden lama sudah di-mute.
 * - Peramban butuh interaksi pengguna dulu, jadi ada `enableSound()`.
 */
export function useAlarmAudio(openIncidentIds: number[], repeatS = 5) {
  const [enabled, setEnabled] = useState(false);
  const [mutedIds, setMutedIds] = useState<Set<number>>(new Set());
  const ctxRef = useRef<AudioContext | null>(null);

  const ringing = enabled && openIncidentIds.some(id => !mutedIds.has(id));

  const beep = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // Dua nada naik-turun, 3 kali (pola sirene pendek)
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const start = t0 + i * 0.5;
      osc.frequency.setValueAtTime(880, start);
      osc.frequency.setValueAtTime(660, start + 0.25);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.48);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    }
  }, []);

  useEffect(() => {
    if (!ringing) return;
    beep();
    const t = setInterval(beep, Math.max(2, repeatS) * 1000);
    return () => clearInterval(t);
  }, [ringing, repeatS, beep]);

  // Bersihkan id yang sudah tidak terbuka
  useEffect(() => {
    setMutedIds(prev => {
      const next = new Set([...prev].filter(id => openIncidentIds.includes(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [openIncidentIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function enableSound() {
    if (!ctxRef.current) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    ctxRef.current.resume();
    setEnabled(true);
  }

  const mute = (id: number) => setMutedIds(prev => new Set(prev).add(id));
  const muteAll = () => setMutedIds(new Set(openIncidentIds));
  const isMuted = (id: number) => mutedIds.has(id);

  return { enabled, ringing, enableSound, mute, muteAll, isMuted, testBeep: beep };
}
