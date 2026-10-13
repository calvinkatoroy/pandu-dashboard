-- PANDU: penanda "tidak terjangkau/inaktif" + retensi data (PLAN §3, §5, §8)
-- Butuh extension pg_cron (aktifkan di Supabase: Database → Extensions → pg_cron).

create extension if not exists pg_cron;

-- Default settings (idempoten)
insert into settings (key, value) values
  ('heartbeat_timeout_s', '120'),
  ('helmet_threshold_s', '30'),
  ('battery_low_mv', '3500'),
  ('danger_auto_clear_hb', '2'),
  ('alarm_repeat_s', '5'),
  ('escalation_s', '60'),
  ('data_retention_days', '90')
on conflict (key) do nothing;

-- Tandai Vest yang heartbeat-nya berhenti > timeout sebagai Warning "Tidak terjangkau".
-- Danger tidak diturunkan (insiden terbuka tetap prioritas), Nonaktif (OFF) tidak disentuh.
create or replace function mark_unreachable_vests() returns integer
language plpgsql security definer as $$
declare
  timeout_s integer;
  n integer;
begin
  select coalesce((select value::int from settings where key = 'heartbeat_timeout_s'), 120) into timeout_s;

  update vest_state vs
     set stage = 'warning',
         status_text = 'Tidak terjangkau',
         offline = true,
         updated_at = now()
   where vs.last_seen_at is not null
     and vs.last_seen_at < now() - make_interval(secs => timeout_s)
     and vs.stage in ('safe', 'warning')
     and coalesce(vs.status_text, '') <> 'Tidak terjangkau'
     and coalesce(vs.status_text, '') <> 'Vest dimatikan';
  get diagnostics n = row_count;

  -- Gateway tanpa uplink > timeout
  update gateways
     set status = 'offline'
   where last_seen_at < now() - make_interval(secs => timeout_s)
     and coalesce(status, '') <> 'offline';

  return n;
end;
$$;

-- Hapus event lebih lama dari retensi (privasi posisi pekerja)
create or replace function purge_old_events() returns integer
language plpgsql security definer as $$
declare
  days integer;
  n integer;
begin
  select coalesce((select value::int from settings where key = 'data_retention_days'), 90) into days;
  -- Lepas referensi vest_state.last_event_id dulu agar FK tidak menghalangi
  update vest_state set last_event_id = null
   where last_event_id in (select id from events where received_at < now() - make_interval(days => days));
  delete from events where received_at < now() - make_interval(days => days);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Jadwal: pg_cron minimum 1 menit; untuk resolusi 30 s, jalankan dua job dengan jeda.
select cron.unschedule(jobname) from cron.job
 where jobname in ('pandu-unreachable', 'pandu-unreachable-30s', 'pandu-purge');

select cron.schedule('pandu-unreachable', '* * * * *', $$select mark_unreachable_vests();$$);
select cron.schedule('pandu-unreachable-30s', '* * * * *', $$select pg_sleep(30); select mark_unreachable_vests();$$);
select cron.schedule('pandu-purge', '15 3 * * *', $$select purge_old_events();$$);

-- Realtime untuk gateways (status di ringkasan atas)
do $$ begin
  alter publication supabase_realtime add table gateways;
exception when duplicate_object then null;
end $$;
