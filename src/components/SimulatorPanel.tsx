import { useState } from 'react';
import { SCENARIOS, buildSimulatedPayload, type Scenario } from '../lib/simulator';

const SUPABASE_URL = 'https://mgnlxkzmiqfxssbwuzpu.supabase.co';
const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest`;

export default function SimulatorPanel() {
  const [open, setOpen] = useState(false);
  const [vestId, setVestId] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function send(scenario: Scenario) {
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
          'x-device-key': 'pandu-gw1-dev-key',
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
        <div className="border-t border-white/5 p-3">
          {/* Vest selector */}
          <div className="mb-2">
            <label className="text-[10px] uppercase tracking-wider text-white/30">Vest</label>
            <select
              value={vestId}
              onChange={e => setVestId(Number(e.target.value))}
              className="mt-0.5 w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs text-white"
            >
              {Array.from({ length: 8 }, (_, i) => (
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
