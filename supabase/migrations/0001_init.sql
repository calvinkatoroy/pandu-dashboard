-- PANDU dashboard schema
-- Kontrak: docs/DATA_CONTRACT.md, PLAN.md section 5

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type stage_t as enum ('safe', 'warning', 'danger', 'inactive');
create type event_type_t as enum ('HB', 'SOS', 'FALL', 'MOB', 'OFF');
create type incident_kind_t as enum ('SOS', 'FALL', 'MOB');
create type incident_resolution_t as enum ('auto', 'dismissed');
create type user_role_t as enum ('admin', 'operator', 'viewer');

-- Gateways
create table gateways (
  id text primary key,
  name text not null default 'Gateway',
  lat double precision,
  lon double precision,
  last_seen_at timestamptz,
  status text,
  sd_ok boolean default true,
  wifi_ok boolean default true,
  created_at timestamptz not null default now()
);

-- Vests
create table vests (
  id smallint primary key check (id between 1 and 8),
  name text not null,
  assigned_to text,
  helmet_label text,
  active boolean not null default true,
  mac text,
  created_at timestamptz not null default now()
);

-- Events (raw log)
create table events (
  id bigint generated always as identity primary key,
  gateway_id text not null references gateways(id) on delete cascade,
  vest_id smallint not null references vests(id) on delete cascade,
  seq integer not null,
  type event_type_t not null,
  lat double precision,
  lon double precision,
  pos_age_s integer,
  bat_mv integer,
  helm smallint check (helm in (0,1,2)),
  rssi integer,
  snr real,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (gateway_id, vest_id, seq)
);
create index events_vest_id_idx on events (vest_id, received_at desc);
create index events_type_idx on events (type, received_at desc);

-- Vest state (latest, fast read)
create table vest_state (
  vest_id smallint primary key references vests(id) on delete cascade,
  last_event_id bigint references events(id),
  stage stage_t not null default 'inactive',
  status_text text,
  lat double precision,
  lon double precision,
  pos_fix_at timestamptz,
  bat_mv integer,
  helm smallint,
  rssi integer,
  snr real,
  last_seen_at timestamptz,
  offline boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Incidents (alarm lifecycle)
create table incidents (
  id bigint generated always as identity primary key,
  vest_id smallint not null references vests(id) on delete cascade,
  kind incident_kind_t not null,
  stage stage_t not null default 'danger',
  opened_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  muted_at timestamptz,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution incident_resolution_t,
  notes text
);
create index incidents_open_idx on incidents (vest_id, resolved_at) where resolved_at is null;

-- Commands to gateway (P2 downlink)
create table commands (
  id bigint generated always as identity primary key,
  gateway_id text not null references gateways(id) on delete cascade,
  kind text not null,
  payload jsonb,
  status text not null default 'pending',
  created_by uuid,
  created_at timestamptz not null default now()
);

-- User profiles
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role user_role_t not null default 'viewer',
  created_at timestamptz not null default now()
);

-- Settings (thresholds)
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Audit log
create table audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  target text,
  at timestamptz not null default now()
);
create index audit_log_user_idx on audit_log (user_id, at desc);

-- Push subscriptions
create table push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(user_id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table gateways enable row level security;
alter table vests enable row level security;
alter table events enable row level security;
alter table vest_state enable row level security;
alter table incidents enable row level security;
alter table commands enable row level security;
alter table profiles enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;
alter table push_subscriptions enable row level security;

-- Helper: get current user role
create or replace function auth_role() returns user_role_t
language sql stable security definer as $$
  select role from profiles where user_id = auth.uid();
$$;

-- Gateways: all authenticated read
create policy "gateways read" on gateways for select using (auth.role() = 'authenticated');
create policy "gateways write" on gateways for all using (auth_role() = 'admin');

-- Vests: all read, admin/operator write
create policy "vests read" on vests for select using (auth.role() = 'authenticated');
create policy "vests write" on vests for all using (auth_role() in ('admin','operator'));

-- Events: all read
create policy "events read" on events for select using (auth.role() = 'authenticated');

-- Vest state: all read
create policy "state read" on vest_state for select using (auth.role() = 'authenticated');

-- Incidents: all read, operator/admin can update (mute/ack/dismiss)
create policy "incidents read" on incidents for select using (auth.role() = 'authenticated');
create policy "incidents update" on incidents for update using (auth_role() in ('admin','operator'));
create policy "incidents insert" on incidents for insert with check (auth_role() in ('admin','operator'));

-- Commands: admin/operator
create policy "commands all" on commands for all using (auth_role() in ('admin','operator'));

-- Profiles: read own + all; write own (admin all)
create policy "profiles read" on profiles for select using (auth.role() = 'authenticated');
create policy "profiles write" on profiles for update using (auth.uid() = user_id or auth_role() = 'admin');

-- Settings: read all, admin write
create policy "settings read" on settings for select using (auth.role() = 'authenticated');
create policy "settings write" on settings for all using (auth_role() = 'admin');

-- Audit log: read all (operator/admin), insert own
create policy "audit read" on audit_log for select using (auth_role() in ('admin','operator'));
create policy "audit insert" on audit_log for insert with check (auth.uid() = user_id or auth_role() = 'admin');

-- Push subscriptions: own
create policy "push own" on push_subscriptions for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (user_id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'viewer')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Realtime publication
alter publication supabase_realtime add table vest_state;
alter publication supabase_realtime add table incidents;
alter publication supabase_realtime add table events;
