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

function validateEvent(ev: IngestEvent): string | null {
  if (!VALID_TYPES.includes(ev.type)) return `invalid type: ${ev.type}`;
  if (ev.vest_id < 1 || ev.vest_id > 8) return `vest_id out of range: ${ev.vest_id}`;
  if (![0, 1, 2].includes(ev.helm)) return `invalid helm: ${ev.helm}`;
  if (ev.bat_mv < 2500 || ev.bat_mv > 4500) return `bat_mv out of range: ${ev.bat_mv}`;
  if (ev.lat !== null && (ev.lat < -90 || ev.lat > 90)) return `lat out of range`;
  if (ev.lon !== null && (ev.lon < -180 || ev.lon > 180)) return `lon out of range`;
  if (ev.rssi < -140 || ev.rssi > 0) return `rssi out of range: ${ev.rssi}`;
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

  if (!body.gateway_id || !Array.isArray(body.events) || body.events.length === 0) {
    return json({ error: 'missing gateway_id or events' }, 422);
  }
  if (body.events.length > 100) {
    return json({ error: 'too many events (max 100)' }, 422);
  }

  const settings = await getSettings();
  let accepted = 0;
  let duplicates = 0;
  const rejected: { index: number; reason: string }[] = [];

  // Process events in order (oldest first)
  const events = [...body.events].sort((a, b) =>
    new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  );

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const originalIndex = body.events.indexOf(ev);
    const err = validateEvent(ev);
    if (err) {
      rejected.push({ index: originalIndex, reason: err });
      continue;
    }

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
        .single();

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
        .single();

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
      .single();

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
