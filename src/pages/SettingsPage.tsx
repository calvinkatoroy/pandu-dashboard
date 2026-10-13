import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import type { Settings, UserRole } from '../lib/types';
import { DEFAULT_SETTINGS } from '../hooks/useVestData';
import { PageShell, Card, Notice, inputCls, btnPrimary, btnGhost } from '../components/ui';

interface Props { simMode: boolean; role: UserRole | null; }

const FIELDS: { key: keyof Settings; label: string; unit: string; min: number; max: number; help: string }[] = [
  { key: 'heartbeat_timeout_s', label: 'Timeout heartbeat', unit: 's', min: 30, max: 900, help: '≈4× interval HB 30 s. Lewat batas → Warning "tidak terjangkau".' },
  { key: 'helmet_threshold_s', label: 'Ambang helm tidak terdengar', unit: 's', min: 5, max: 300, help: 'Sama dengan firmware (30 s).' },
  { key: 'battery_low_mv', label: 'Baterai rendah', unit: 'mV', min: 3000, max: 4200, help: 'Di bawah nilai ini → Warning.' },
  { key: 'danger_auto_clear_hb', label: 'Padam otomatis Danger', unit: 'HB', min: 1, max: 10, help: 'Jumlah heartbeat bersih berturut-turut untuk menutup insiden (auto).' },
  { key: 'alarm_repeat_s', label: 'Ulang bunyi alarm', unit: 's', min: 2, max: 60, help: 'Bunyi berulang sampai di-mute.' },
  { key: 'escalation_s', label: 'Eskalasi alarm belum di-ack', unit: 's', min: 10, max: 600, help: 'Banner berkedip lebih mencolok.' },
  { key: 'data_retention_days', label: 'Retensi data posisi', unit: 'hari', min: 7, max: 365, help: 'Privasi K3 (event lebih lama dihapus oleh cron).' },
];

/** Pengaturan ambang (PLAN §3, §6.4). Hanya admin yang boleh mengubah (RLS settings write). */
export default function SettingsPage({ simMode, role }: Props) {
  const canEdit = role === 'admin';
  const [values, setValues] = useState<Settings>(DEFAULT_SETTINGS);
  const [initial, setInitial] = useState<Settings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  useEffect(() => {
    if (simMode) return;
    supabase.from('settings').select('key, value').then(({ data }) => {
      const s = { ...DEFAULT_SETTINGS };
      (data ?? []).forEach(r => {
        if (r.key in s) (s as Record<string, number>)[r.key] = Number(r.value);
      });
      setValues(s); setInitial(s);
    });
  }, [simMode]);

  const dirty = FIELDS.some(f => values[f.key] !== initial[f.key]);
  const invalid = FIELDS.find(f => Number.isNaN(values[f.key]) || values[f.key] < f.min || values[f.key] > f.max);

  async function save() {
    if (invalid) { setMsg({ tone: 'warn', text: `${invalid.label} harus ${invalid.min}–${invalid.max} ${invalid.unit}.` }); return; }
    setBusy(true);
    if (!simMode) {
      const changed = FIELDS.filter(f => values[f.key] !== initial[f.key]);
      const rows = changed.map(f => ({ key: f.key, value: String(values[f.key]), updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) { setMsg({ tone: 'warn', text: error.message }); setBusy(false); return; }
      await logAudit('settings_update', changed.map(f => `${f.key}=${values[f.key]}`).join(','));
    }
    setInitial(values);
    setMsg({ tone: 'info', text: simMode ? 'Tersimpan (lokal, mode Sim).' : 'Pengaturan tersimpan.' });
    setBusy(false);
  }

  async function askNotif() {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
    if (p === 'granted') new Notification('PANDU', { body: 'Notifikasi aktif. Danger akan muncul di sini.' });
  }

  return (
    <PageShell
      title="Pengaturan"
      subtitle="Ambang stage dan alarm. Default sesuai DATA_CONTRACT §4 (belum disepakati final)."
      actions={canEdit && (
        <>
          <button onClick={() => setValues(DEFAULT_SETTINGS)} className={btnGhost}>Reset default</button>
          <button id="save-settings-btn" onClick={save} disabled={!dirty || busy} className={btnPrimary}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>
      )}
    >
      {!canEdit && <Notice tone="warn">Hanya admin yang dapat mengubah pengaturan.</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card title="Ambang stage & alarm">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(f => {
            const bad = values[f.key] < f.min || values[f.key] > f.max;
            return (
              <label key={f.key} className="block">
                <span className="text-xs font-medium text-white/70">{f.label}</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={`setting-${f.key}`}
                    type="number"
                    min={f.min}
                    max={f.max}
                    disabled={!canEdit}
                    value={values[f.key]}
                    onChange={e => setValues({ ...values, [f.key]: Number(e.target.value) })}
                    className={`${inputCls} font-mono ${bad ? 'border-alert/60' : ''}`}
                  />
                  <span className="w-10 text-xs text-white/40">{f.unit}</span>
                </div>
                <span className="mt-1 block text-[11px] text-white/35">{f.help}</span>
              </label>
            );
          })}
        </div>
      </Card>

      <Card title="Notifikasi perangkat ini">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-white/70">
            Status: <b className="font-mono">{notifPerm === 'unsupported' ? 'tidak didukung' : notifPerm}</b>
          </span>
          {notifPerm === 'default' && <button onClick={askNotif} className={btnPrimary}>Izinkan notifikasi</button>}
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          Web Push saat aplikasi tertutup (PWA) direncanakan di Fase 3.
        </p>
      </Card>
    </PageShell>
  );
}
