-- Perbaikan keamanan dari audit 13 Okt 2026.

-- 1. User tidak boleh mengubah role sendiri; hanya admin.
drop policy if exists "profiles write" on profiles;
create policy "profiles update" on profiles for update
  using (auth.uid() = user_id or auth_role() = 'admin')
  with check (auth_role() = 'admin' or role = auth_role());

-- 2. Device key gateway tidak boleh terbaca user login (Edge Function pakai service role, bypass RLS).
drop policy if exists "settings read" on settings;
create policy "settings read" on settings for select
  using (auth.role() = 'authenticated' and key <> 'gateway_device_key');

-- 3. Satu insiden terbuka per Vest (cegah duplikat saat request bersamaan).
create unique index if not exists incidents_one_open_per_vest
  on incidents (vest_id) where resolved_at is null;
