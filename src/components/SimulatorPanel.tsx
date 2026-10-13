import { useState } from 'react';
import { SCENARIOS, buildSimulatedPayload, type Scenario } from '../lib/simulator';

import { SUPABASE_URL } from '../lib/supabase';

const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest`;

interface Props {
  simMode: boolean;
  vestCount: number;
  onApplyLocal: (scenario: Scenario, vestId: number) => void;
  fleet?: 1 | 8;
  onFleetChange?: (f: 1 | 8) => void;
}

export default function SimulatorPanel({ simMode, vestCount, onApplyLocal, fleet, onFleetChange }: Props) {
  const [open, setOpen] = useState(false);
  const [vestId, setVestId] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function send(scenario: Scenario) {
    if (simMode) {
      onApplyLocal(scenario, vestId);
      setLastResult(`✓ skenario "${scenario}" diterapkan ke Vest ${vestId} (lokal)`);
      return;
    }
    if (!import.meta.env.DEV) {
      setLastResult('Kirim ke ingest hanya tersedia di build dev (key tidak disertakan di produksi)');
      return;
    }
    setBusy(true);
    setLastResult(null);
    const payload = buildSimulatedPayload(scenario, vestId);

    if (payload.events.length === 0) {
      setLastResult('Offline — tidak ada paket dikirim (server akan tandai stale via cron)');
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': import.meta.env.VITE_GATEWAY_DEVICE_KEY ?? '',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult(`✓ accepted: ${data.accepted}, dup: ${data.duplicates}`);
      } else {
        setLastResult(`✗ ${data.error ?? 'gagal'}`);
      }
    } catch (e) {
      setLastResult(`✗ ${e instanceof Error ? e.message : 'network error'}`);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-ink-800/95 backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
      >
        <span className="font-mono uppercase tracking-wider text-safe">Simulator</span>
        <span className="text-white/40">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="w-56 border-t border-white/5 p-3">
          <p className="mb-2 text-[10px] text-white/40">
            {simMode ? 'Mode Sim: data lokal di browser.' : 'Mode Live: kirim ke Edge Function ingest.'}
          </p>
          {simMode && onFleetChange && (
            <div className="mb-2 flex gap-1">
              {([1, 8] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { onFleetChange(f); setVestId(1); }}
                  className={`flex-1 rounded-lg px-2 py-1 text-[11px] ${fleet === f ? 'bg-safe/20 text-safe' : 'bg-ink-700 text-white/50'}`}
                >
                  {f} Vest
                </button>
              ))}
            </div>
          )}
          {/* Vest selector */}
          <div className="mb-2">
            <label className="text-[10px] uppercase tracking-wider text-white/30">Vest</label>
            <select
              value={vestId}
              onChange={e => setVestId(Number(e.target.value))}
              className="mt-0.5 w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs text-white"
            >
              {Array.from({ length: Math.max(1, vestCount) }, (_, i) => (
                <option key={i} value={i + 1}>Vest {String(i + 1).padStart(2, '0')}</option>
              ))}
            </select>
          </div>

          {/* Scenario buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            {SCENARIOS.map(s => (
              <button
                key={s.key}
                disabled={busy}
                onClick={() => send(s.key)}
                className="rounded-lg border border-white/10 bg-ink-700 px-2 py-1.5 text-[11px] text-white/70 hover:bg-ink-600 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>

          {lastResult && (
            <div className="mt-2 font-mono text-[10px] text-white/50">{lastResult}</div>
          )}
        </div>
      )}
    </div>
  );
}
