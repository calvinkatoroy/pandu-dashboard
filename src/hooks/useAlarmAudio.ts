import { useEffect, useRef, useState } from 'react';

const ALARM_SOUND = 'https://actions.google.com/sounds/v1/alarms/emergency_alarm.ogg';

export function useAlarmAudio(hasDanger: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio(ALARM_SOUND);
    a.loop = true;
    a.volume = 0.7;
    audioRef.current = a;
    return () => { a.pause(); a.src = ''; };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (hasDanger && enabled && !muted) {
      a.play().catch(() => {});
    } else {
      a.pause();
      a.currentTime = 0;
    }
  }, [hasDanger, enabled, muted]);

  function enableSound() {
    setEnabled(true);
    setMuted(false);
    // Play a short test to satisfy autoplay policy
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        if (!hasDanger) setTimeout(() => audioRef.current?.pause(), 200);
      }).catch(() => {});
    }
  }

  function mute() { setMuted(true); }
  function unmute() { setMuted(false); }

  return { enabled, muted, enableSound, mute, unmute };
}
