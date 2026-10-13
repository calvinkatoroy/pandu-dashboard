import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const VALID_TYPES = ['HB', 'SOS', 'FALL', 'MOB', 'OFF'];
const DANGER_TYPES = ['SOS', 'FALL', 'MOB'];

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

const isInt = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

function validateEvent(ev: unknown): string | null {
  if (!ev || typeof ev !== 'object') return 'event is not an object';
  const e = ev as Record<string, unknown>;
  if (typeof e.type !== 'string' || !VALID_TYPES.includes(e.type)) return `invalid type: ${e.type}`;
  if (!isInt(e.vest_id, 1, 8)) return `vest_id out of range: ${e.vest_id}`;
  if (!isInt(e.seq, 0, 65535)) return `seq out of range: ${e.seq}`;
  if (!isInt(e.helm, 0, 2)) return `invalid helm: ${e.helm}`;
  if (!isInt(e.bat_mv, 2500, 4500)) return `bat_mv out of range: ${e.bat_mv}`;
  if (e.lat !== null && !isNum(e.lat, -90, 90)) return 'lat out of range';
  if (e.lon !== null && !isNum(e.lon, -180, 180)) return 'lon out of range';
  if (!isInt(e.rssi, -140, 0)) return `rssi out of range: ${e.rssi}`;
  if (typeof e.received_at !== 'string' || isNaN(Date.parse(e.received_at))) return 'invalid received_at';
  return null;
}

async function getSettings() {
  const { data } = await supabase.from('settings').select('key, value');
  const map: Record<string, string> = {};
  (data ?? []).forEach(r => { map[r.key] = r.value; });
  return {
    heartbeat_timeout_s: parseInt(map.heartbeat_timeout_s ?? '120'),
    battery_low_mv: parseInt(map.battery_low_mv ?? '3500'),
    danger_auto_clear_hb: parseInt(map.danger_auto_clear_hb ?? '2'),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  const deviceKey = req.headers.get('x-device-key');
  if (!deviceKey) {
    return json({ error: 'missing x-device-key' }, 401);
  }

  // Verify device key against settings
  const { data: keyRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'gateway_device_key')
    .single();
  if (!keyRow || keyRow.value !== deviceKey) {
    return json({ error: 'invalid device key' }, 401);
  }

  let body: { gateway_id: string; sent_at: string; events: IngestEvent[] };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: 'invalid JSON' }, 422);
  }

  if (!body || typeof body.gateway_id !== 'string' || !body.gateway_id || !Array.isArray(body.events) || body.events.length === 0) {
    return json({ error: 'missing gateway_id or events' }, 422);
  }
  if (body.events.length > 100) {
    return json({ error: 'too many events (max 100)' }, 422);
  }

  const settings = await getSettings();
  let accepted = 0;
  let duplicates = 0;

  // Validasi dulu (indeks asli dipertahankan), lalu proses yang valid urut terlama.
  const rejected: { index: number; reason: string }[] = [];
  const valid: { ev: IngestEvent; index: number }[] = [];
  body.events.forEach((raw, index) => {
    const err = validateEvent(raw);
    if (err) rejected.push({ index, reason: err });
    else valid.push({ ev: raw, index });
  });
  valid.sort((x, y) => Date.parse(x.ev.received_at) - Date.parse(y.ev.received_at));

  for (const { ev, index: originalIndex } of valid) {
    // Insert event (idempotent via unique constraint)
    const { data: inserted, error } = await supabase.from('events').insert({
      gateway_id: body.gateway_id,
      vest_id: ev.vest_id,
      seq: ev.seq,
      type: ev.type,
      lat: ev.lat,
      lon: ev.lon,
      pos_age_s: ev.pos_age_s,
      bat_mv: ev.bat_mv,
      helm: ev.helm,
      rssi: ev.rssi,
      snr: ev.snr,
      received_at: ev.received_at,
    }).select('id').single();

    if (error) {
      if (error.code === '23505') {
        // unique violation — duplicate
        duplicates++;
        continue;
      }
      rejected.push({ index: originalIndex, reason: error.message });
      continue;
    }

    accepted++;

    // Update gateway last_seen
    await supabase.from('gateways')
      .update({ last_seen_at: ev.received_at, status: 'online' })
      .eq('id', body.gateway_id);

    // Handle incident logic for danger types
    if (DANGER_TYPES.includes(ev.type)) {
      // Check for existing open incident for this vest
      const { data: openIncident } = await supabase
        .from('incidents')
        .select('id')
        .eq('vest_id', ev.vest_id)
        .is('resolved_at', null)
        .maybeSingle();

      if (openIncident) {
        // Update existing incident
        await supabase.from('incidents').update({
          kind: ev.type as 'SOS' | 'FALL' | 'MOB',
          last_event_at: ev.received_at,
        }).eq('id', openIncident.id);
      } else {
        // Open new incident
        await supabase.from('incidents').insert({
          vest_id: ev.vest_id,
          kind: ev.type as 'SOS' | 'FALL' | 'MOB',
          stage: 'danger',
          opened_at: ev.received_at,
          last_event_at: ev.received_at,
        });
      }
    }

    // Auto-resolve danger if 2 clean heartbeats
    if (ev.type === 'HB') {
      const { data: openIncident } = await supabase
        .from('incidents')
        .select('id, last_event_at')
        .eq('vest_id', ev.vest_id)
        .is('resolved_at', null)
        .maybeSingle();

      if (openIncident) {
        // Count clean heartbeats since last danger event
        const { data: recentHbs } = await supabase
          .from('events')
          .select('type, received_at')
          .eq('vest_id', ev.vest_id)
          .gt('received_at', openIncident.last_event_at)
          .order('received_at', { ascending: true });

        const cleanHbs = (recentHbs ?? []).filter(e => e.type === 'HB');
        if (cleanHbs.length >= settings.danger_auto_clear_hb) {
          await supabase.from('incidents').update({
            resolved_at: ev.received_at,
            resolution: 'auto',
          }).eq('id', openIncident.id);
        }
      }
    }

    // Compute and update vest_state
    const { data: openInc } = await supabase
      .from('incidents')
      .select('id')
      .eq('vest_id', ev.vest_id)
      .is('resolved_at', null)
      .maybeSingle();

    const hasOpenDanger = !!openInc;
    let stage: string;
    if (ev.type === 'OFF') {
      stage = 'inactive';
    } else if (hasOpenDanger) {
      stage = 'danger';
    } else if (ev.bat_mv < settings.battery_low_mv) {
      stage = 'warning';
    } else if (ev.helm !== 1) {
      stage = 'warning';
    } else {
      stage = 'safe';
    }

    let statusText = 'Heartbeat normal';
    if (ev.type === 'OFF') statusText = 'Vest dimatikan';
    else if (hasOpenDanger) statusText = `${ev.type} aktif`;
    else if (ev.bat_mv < settings.battery_low_mv) statusText = 'Baterai rendah';
    else if (ev.helm !== 1) statusText = ev.helm === 0 ? 'Helm jauh' : 'Helm tidak terdengar';
    else if (ev.lat === null) statusText = 'Posisi belum tersedia';

    // Event lama (backlog SD) tidak boleh menimpa state yang lebih baru.
    const { data: cur } = await supabase.from('vest_state')
      .select('last_seen_at').eq('vest_id', ev.vest_id).maybeSingle();
    if (cur?.last_seen_at && Date.parse(cur.last_seen_at) > Date.parse(ev.received_at)) continue;

    await supabase.from('vest_state').upsert({
      vest_id: ev.vest_id,
      last_event_id: inserted?.id ?? null,
      stage,
      status_text: statusText,
      lat: ev.lat,
      lon: ev.lon,
      pos_fix_at: ev.lat !== null ? ev.received_at : null,
      bat_mv: ev.bat_mv,
      helm: ev.helm,
      rssi: ev.rssi,
      snr: ev.snr,
      last_seen_at: ev.received_at,
      offline: ev.type === 'OFF',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'vest_id' });
  }

  return json({ accepted, duplicates, rejected });
});
