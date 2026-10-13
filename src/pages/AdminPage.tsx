import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import type { UserRole, Vest } from '../lib/types';
import { PageShell, Card, Notice, inputCls, btnPrimary, btnGhost } from '../components/ui';

interface Props { simMode: boolean; role: UserRole | null; }

type Draft = Vest & { mac?: string | null };
const EMPTY: Draft = { id: 0, name: '', assigned_to: '', helmet_label: '', active: true, mac: '' };

const SIM_VESTS: Draft[] = [
  { id: 1, name: 'Vest 01', assigned_to: 'Capt. A. Ridwan', helmet_label: 'Helm A1', active: true, mac: null },
];

/** Kelola Vest (PLAN §6.4, P1): tambah/ubah nama pandu, nomor Vest, label helm, aktif/nonaktif. */
export default function AdminPage({ simMode, role }: Props) {
  const canEdit = role === 'admin' || role === 'operator';
  const [vests, setVests] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (simMode) { setVests(prev => prev.length ? prev : SIM_VESTS); return; }
    const { data, error } = await supabase.from('vests').select('*').order('id');
    if (error) setMsg({ tone: 'warn', text: error.message });
    setVests((data ?? []) as Draft[]);
  }
  useEffect(() => { load(); }, [simMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const usedIds = new Set(vests.map(v => v.id));
  const freeIds = Array.from({ length: 8 }, (_, i) => i + 1).filter(i => !usedIds.has(i));

  function startNew() {
    if (!freeIds.length) { setMsg({ tone: 'warn', text: 'Maksimal 8 Vest.' }); return; }
    setIsNew(true);
    setDraft({ ...EMPTY, id: freeIds[0], name: `Vest ${String(freeIds[0]).padStart(2, '0')}` });
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setMsg({ tone: 'warn', text: 'Nama Vest wajib diisi.' }); return; }
    setBusy(true);
    const row = {
      id: draft.id, name: draft.name.trim(),
      assigned_to: draft.assigned_to?.trim() || null,
      helmet_label: draft.helmet_label?.trim() || null,
      active: draft.active, mac: draft.mac?.trim() || null,
    };
    if (simMode) {
      setVests(prev => [...prev.filter(v => v.id !== row.id), row].sort((a, b) => a.id - b.id));
    } else {
      const { error } = await supabase.from('vests').upsert(row, { onConflict: 'id' });
      if (error) { setMsg({ tone: 'warn', text: error.message }); setBusy(false); return; }
      await logAudit(isNew ? 'vest_create' : 'vest_update', `vest:${row.id}`);
      await load();
    }
    setMsg({ tone: 'info', text: `${row.name} tersimpan.` });
    setDraft(null);
    setBusy(false);
  }

  async function toggleActive(v: Draft) {
    const next = { ...v, active: !v.active };
    if (simMode) { setVests(prev => prev.map(x => x.id === v.id ? next : x)); return; }
    const { error } = await supabase.from('vests').update({ active: next.active }).eq('id', v.id);
    if (error) { setMsg({ tone: 'warn', text: error.message }); return; }
    await logAudit(next.active ? 'vest_activate' : 'vest_deactivate', `vest:${v.id}`);
    load();
  }

  return (
    <PageShell
      title="Kelola Vest"
      subtitle="Nomor Vest 1–8, nama pandu, label helm berpasangan"
      actions={canEdit && <button id="add-vest-btn" onClick={startNew} className={btnPrimary}>+ Tambah Vest</button>}
    >
      {!canEdit && <Notice tone="warn">Peran viewer hanya dapat melihat. Hubungi admin untuk perubahan.</Notice>}
      {simMode && <Notice>Mode Sim: perubahan hanya tersimpan di browser.</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {draft && (
        <Card title={isNew ? 'Vest baru' : `Ubah ${draft.name}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">Nomor Vest
              <select
                className={`${inputCls} mt-1`}
                value={draft.id}
                disabled={!isNew}
                onChange={e => setDraft({ ...draft, id: Number(e.target.value) })}
              >
                {(isNew ? freeIds : [draft.id]).map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/50">Nama Vest
              <input id="vest-name-input" className={`${inputCls} mt-1`} value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="text-xs text-white/50">Dipakai oleh (nama pandu)
              <input className={`${inputCls} mt-1`} value={draft.assigned_to ?? ''} placeholder="mis. Capt. A. Ridwan"
                onChange={e => setDraft({ ...draft, assigned_to: e.target.value })} />
            </label>
            <label className="text-xs text-white/50">Label helm
              <input className={`${inputCls} mt-1`} value={draft.helmet_label ?? ''} placeholder="mis. Helm A1"
                onChange={e => setDraft({ ...draft, helmet_label: e.target.value })} />
            </label>
            <label className="text-xs text-white/50">MAC (opsional)
              <input className={`${inputCls} mt-1 font-mono`} value={draft.mac ?? ''} placeholder="AA:BB:CC:DD:EE:FF"
                onChange={e => setDraft({ ...draft, mac: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-white/70">
              <input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-[#1fa37a]" />
              Aktif
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDraft(null)} className={btnGhost}>Batal</button>
            <button id="save-vest-btn" onClick={save} disabled={busy} className={btnPrimary}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </Card>
      )}

      <Card title={`Daftar Vest (${vests.length}/8)`}>
        {vests.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/30">Belum ada Vest terdaftar</p>
        ) : (
          <div className="divide-y divide-white/5">
            {vests.map(v => (
              <div key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 font-mono text-sm text-white/70">{v.id}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{v.name}
                    {!v.active && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">nonaktif</span>}
                  </div>
                  <div className="truncate text-xs text-white/40">
                    {v.assigned_to || 'belum ditugaskan'} · {v.helmet_label || 'tanpa label helm'}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(v)} className={btnGhost}>{v.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button onClick={() => { setIsNew(false); setDraft({ ...v }); }} className={btnGhost}>Ubah</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  );
}
