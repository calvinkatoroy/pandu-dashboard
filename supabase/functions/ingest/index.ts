import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeStage, validateEvent } from '../_shared/stage.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Disarankan: supabase secrets set GATEWAY_DEVICE_KEY=...  (fallback: settings.gateway_device_key)
const ENV_DEVICE_KEY = Deno.env.get('GATEWAY_DEVICE_KEY');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const DANGER_TYPES = ['SOS', 'FALL', 'MOB'];

// Rate limit per isolate (ponytail: counter di memori, per-instance; pindah ke tabel bila butuh global)
const RATE_MAX = 30;
const hits = new Map<string, number[]>();
function rateLimited(id: string): boolean {
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(id, recent);
  return recent.length > RATE_MAX;
}

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

function cors(res: Response) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-device-key');
  return res;
}

function json(data: unknown, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

interface IngestEvent {
  vest_id: number;
  seq: number;
  type: string;
  lat: number | null;
  lon: number | null;
  pos_age_s: number;
  bat_mv: number;
  helm: number;
  rssi: number;
  snr: number;
  received_at: string;
}


async function getSettings() {
  const { data } = await supabase.from('settings').select('key, value');
  const map: Record<string, string> = {};
  (data ?? []).forEach(r => { map[r.key] = r.value; });
  const num = (k: string, d: number) => parseInt(map[k] ?? '') || d;
  return {
    heartbeat_timeout_s: num('heartbeat_timeout_s', 120),
    helmet_threshold_s: num('helmet_threshold_s', 30),
    battery_low_mv: num('battery_low_mv', 3500),
    danger_auto_clear_hb: num('danger_auto_clear_hb', 2),
    gateway_device_key: map.gateway_device_key as string | undefined,
  };
}

interface OpenIncident { id: number; last_event_at: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const deviceKey = req.headers.get('x-device-key');
  if (!deviceKey) return json({ error: 'missing x-device-key' }, 401);

  const settings = await getSettings();
  const expected = ENV_DEVICE_KEY ?? settings.gateway_device_key;
  if (!expected || !safeEqual(deviceKey, expected)) return json({ error: 'invalid device key' }, 401);

  let body: { gateway_id: string; sent_at: string; events: unknown[] };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: 'invalid JSON' }, 422);
  }
  if (!body || typeof body.gateway_id !== 'string' || !body.gateway_id || !Array.isArray(body.events) || body.events.length === 0) {
    return json({ error: 'missing gateway_id or events' }, 422);
  }
  if (body.events.length > 100) return json({ error: 'too many events (max 100)' }, 422);

  if (rateLimited(body.gateway_id)) return json({ error: 'too many requests' }, 429);

  const { data: gw } = await supabase.from('gateways').select('id').eq('id', body.gateway_id).maybeSingle();
  if (!gw) return json({ error: `unknown gateway_id: ${body.gateway_id}` }, 422);

  // Validasi per event (indeks asli dipertahankan), proses yang valid urut terlama.
  const rejected: { index: number; reason: string }[] = [];
  const valid: { ev: IngestEvent; index: number }[] = [];
  body.events.forEach((raw, index) => {
    const err = validateEvent(raw);
    if (err) rejected.push({ index, reason: err });
    else valid.push({ ev: raw as IngestEvent, index });
  });
  valid.sort((x, y) => Date.parse(x.ev.received_at) - Date.parse(y.ev.received_at));
  if (valid.length === 0) return json({ accepted: 0, duplicates: 0, rejected });

  // Satu insert untuk semua event; baris duplikat (gateway_id, vest_id, seq, received_at) diabaikan oleh DB.
  const rows = valid.map(({ ev }) => ({
    gateway_id: body.gateway_id, vest_id: ev.vest_id, seq: ev.seq, type: ev.type,
    lat: ev.lat, lon: ev.lon, pos_age_s: ev.pos_age_s ?? null, bat_mv: ev.bat_mv,
    helm: ev.helm, rssi: ev.rssi, snr: ev.snr ?? null, received_at: ev.received_at,
  }));
  const { data: inserted, error: insErr } = await supabase.from('events')
    .upsert(rows, { onConflict: 'gateway_id,vest_id,seq,received_at', ignoreDuplicates: true })
    .select('id, vest_id, seq, received_at');
  if (insErr) return json({ error: insErr.message }, 500);

  // Kunci pakai epoch ms: DB mengembalikan received_at dalam format berbeda dari input.
  const evKey = (v: number, q: number, t: string) => `${v}:${q}:${Date.parse(t)}`;
  const idBySeq = new Map((inserted ?? []).map(r => [evKey(r.vest_id, r.seq, r.received_at), r.id as number]));
  const fresh = valid.filter(({ ev }) => idBySeq.has(evKey(ev.vest_id, ev.seq, ev.received_at)));
  const accepted = fresh.length;
  const duplicates = valid.length - accepted;
  if (accepted === 0) return json({ accepted, duplicates, rejected });

  const vestIds = [...new Set(fresh.map(({ ev }) => ev.vest_id))];
  const [{ data: openRows }, { data: stateRows }] = await Promise.all([
    supabase.from('incidents').select('id, vest_id, last_event_at').in('vest_id', vestIds).is('resolved_at', null),
    supabase.from('vest_state').select('vest_id, last_seen_at, helm_off_since').in('vest_id', vestIds),
  ]);
  const open = new Map<number, OpenIncident | null>(vestIds.map(v => [v, null]));
  (openRows ?? []).forEach(r => open.set(r.vest_id, { id: r.id, last_event_at: r.last_event_at }));
  const prev = new Map((stateRows ?? []).map(r => [r.vest_id as number, r]));

  // Per Vest: logika insiden per event, lalu vest_state ditulis sekali dari event terbaru.
  const lastByVest = new Map<number, { ev: IngestEvent; id: number }>();
  const helmOff = new Map<number, string | null>(vestIds.map(v => [v, prev.get(v)?.helm_off_since ?? null]));

  for (const { ev } of fresh) {
    const inc = open.get(ev.vest_id) ?? null;

    if (DANGER_TYPES.includes(ev.type)) {
      if (inc) {
        await supabase.from('incidents').update({ kind: ev.type, last_event_at: ev.received_at }).eq('id', inc.id);
        open.set(ev.vest_id, { id: inc.id, last_event_at: ev.received_at });
      } else {
        const { data: created, error } = await supabase.from('incidents').insert({
          vest_id: ev.vest_id, kind: ev.type, stage: 'danger',
          opened_at: ev.received_at, last_event_at: ev.received_at,
        }).select('id, last_event_at').single();
        if (error) { // unique index: request lain sudah membuka insiden, cukup perbarui
          await supabase.from('incidents').update({ kind: ev.type, last_event_at: ev.received_at })
            .eq('vest_id', ev.vest_id).is('resolved_at', null);
          open.set(ev.vest_id, { id: -1, last_event_at: ev.received_at });
        } else {
          open.set(ev.vest_id, { id: created.id, last_event_at: created.last_event_at });
        }
      }
    } else if (ev.type === 'HB' && inc && inc.id > 0) {
      // Hitung HB bersih dari DB agar HB dari request lain ikut terhitung.
      const { count } = await supabase.from('events').select('id', { count: 'exact', head: true })
        .eq('vest_id', ev.vest_id).eq('type', 'HB').gt('received_at', inc.last_event_at);
      if ((count ?? 0) >= settings.danger_auto_clear_hb) {
        await supabase.from('incidents').update({ resolved_at: ev.received_at, resolution: 'auto' }).eq('id', inc.id);
        open.set(ev.vest_id, null);
      }
    }

    // Lacak sejak kapan helm tidak dipakai
    const state = prev.get(ev.vest_id);
    if (!state?.last_seen_at || Date.parse(ev.received_at) >= Date.parse(state.last_seen_at)) {
      if (ev.helm === 1) helmOff.set(ev.vest_id, null);
      else if (!helmOff.get(ev.vest_id)) helmOff.set(ev.vest_id, ev.received_at);
    }
    lastByVest.set(ev.vest_id, { ev, id: idBySeq.get(evKey(ev.vest_id, ev.seq, ev.received_at))! });
  }

  for (const [vestId, { ev, id }] of lastByVest) {
    // Event lama (backlog SD) tidak boleh menimpa state yang lebih baru.
    const lastSeen = prev.get(vestId)?.last_seen_at;
    if (lastSeen && Date.parse(lastSeen) > Date.parse(ev.received_at)) continue;

    const hasOpenDanger = !!open.get(vestId);
    const offSince = helmOff.get(vestId);
    const helmOffSeconds = offSince ? (Date.parse(ev.received_at) - Date.parse(offSince)) / 1000 : 0;
    const stage = computeStage({
      type: ev.type, helm: ev.helm, bat_mv: ev.bat_mv, lastSeenSecondsAgo: 0,
      helmOffSeconds, hasOpenDanger, settings,
    });

    let statusText = 'Heartbeat normal';
    if (ev.type === 'OFF') statusText = 'Vest dimatikan';
    else if (hasOpenDanger) statusText = `${ev.type} aktif`;
    else if (ev.bat_mv < settings.battery_low_mv) statusText = 'Baterai rendah';
    else if (stage === 'warning' && ev.helm !== 1) statusText = ev.helm === 0 ? 'Helm jauh' : 'Helm tidak terdengar';
    else if (ev.lat === null) statusText = 'Posisi belum tersedia';

    await supabase.from('vest_state').upsert({
      vest_id: vestId, last_event_id: id, stage, status_text: statusText,
      lat: ev.lat, lon: ev.lon, pos_fix_at: ev.lat !== null ? ev.received_at : null,
      bat_mv: ev.bat_mv, helm: ev.helm, helm_off_since: offSince ?? null,
      rssi: ev.rssi, snr: ev.snr ?? null,
      last_seen_at: ev.received_at, offline: ev.type === 'OFF',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'vest_id' });
  }

  const newest = fresh[fresh.length - 1].ev.received_at;
  await supabase.from('gateways').update({ last_seen_at: newest, status: 'online' }).eq('id', body.gateway_id);

  return json({ accepted, duplicates, rejected });
});
