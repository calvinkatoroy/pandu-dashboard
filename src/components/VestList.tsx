import type { VestWithData } from '../hooks/useVestData';
import { STAGE_META, effectiveStage } from '../lib/stage';
import VestCard from './VestCard';
import { useState } from 'react';

interface Props {
  vests: VestWithData[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  now: number;
  lowBatMv: number;
  heartbeatTimeoutS: number;
}

export default function VestList({ vests, selectedId, onSelect, now, lowBatMv, heartbeatTimeoutS }: Props) {
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning' | 'safe' | 'inactive'>('all');

  const counts = { safe: 0, warning: 0, danger: 0, inactive: 0 };
  const st = (v: (typeof vests)[number]) => effectiveStage(v.state, heartbeatTimeoutS, now);
  vests.forEach(v => { counts[st(v)]++; });

  const filtered = filter === 'all'
    ? vests
    : vests.filter(v => st(v) === filter);

  // Sort: danger first, then warning, then safe, then inactive
  const order = { danger: 0, warning: 1, safe: 2, inactive: 3 };
  const sorted = [...filtered].sort((a, b) =>
    order[st(a)] - order[st(b)]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Stage summary */}
      <div className="grid grid-cols-4 gap-1.5 p-2">
        {(['danger', 'warning', 'safe', 'inactive'] as const).map(stage => {
          const meta = STAGE_META[stage];
          const active = filter === stage;
          return (
            <button
              key={stage}
              onClick={() => setFilter(active ? 'all' : stage)}
              className={`rounded-lg border p-1.5 text-center transition-all ${active ? 'scale-95' : ''}`}
              style={{
                borderColor: active ? meta.color : 'transparent',
                background: active ? meta.bg : 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="font-mono text-base font-bold tabular" style={{ color: meta.color }}>
                {counts[stage]}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-white/55">{meta.label}</div>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {sorted.map(v => (
          <VestCard
            key={v.id}
            vest={v}
            selected={selectedId === v.id}
            onClick={() => onSelect(v.id)}
            now={now}
            lowBatMv={lowBatMv}
            heartbeatTimeoutS={heartbeatTimeoutS}
          />
        ))}
        {sorted.length === 0 && (
          <p className="py-8 text-center text-xs text-white/55">Tidak ada Vest pada stage ini</p>
        )}
      </div>
    </div>
  );
}
