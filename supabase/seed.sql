-- Seed data: 1 gateway, 8 vests, default settings
-- Jalankan setelah migrasi 0001_init.sql

-- Gateway
insert into gateways (id, name, lat, lon, status)
values ('GW1', 'Dermaga Tanjung Priok', -6.1033, 106.8817, 'online')
on conflict (id) do nothing;

-- Vests (8 slots, prototipe fokus Vest 1)
insert into vests (id, name, assigned_to, helmet_label, active) values
  (1, 'Vest 01', 'Capt. A. Ridwan', 'Helm A1', true),
  (2, 'Vest 02', null, 'Helm A2', true),
  (3, 'Vest 03', null, 'Helm A3', true),
  (4, 'Vest 04', null, 'Helm A4', true),
  (5, 'Vest 05', null, 'Helm A5', true),
  (6, 'Vest 06', null, 'Helm A6', true),
  (7, 'Vest 07', null, 'Helm A7', true),
  (8, 'Vest 08', null, 'Helm A8', true)
on conflict (id) do nothing;

-- Default settings (thresholds)
insert into settings (key, value) values
  ('heartbeat_timeout_s', '120'),
  ('helmet_threshold_s', '30'),
  ('battery_low_mv', '3500'),
  ('danger_auto_clear_hb', '2'),
  ('alarm_repeat_s', '5'),
  ('escalation_s', '60'),
  ('data_retention_days', '90'),
  ('gateway_id', 'GW1')
on conflict (key) do nothing;

-- Vest state defaults
insert into vest_state (vest_id, stage, status_text, offline)
select id, 'inactive', 'Belum ada data', true from vests
on conflict (vest_id) do nothing;
