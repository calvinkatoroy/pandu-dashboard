-- handle_new_user dijalankan oleh layanan Auth dengan search_path = auth, sehingga "profiles" tidak ditemukan
-- ("Database error saving new user"). Kunci search_path dan kualifikasi skema.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'viewer'::public.user_role_t)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
