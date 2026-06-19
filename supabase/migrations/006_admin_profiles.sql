-- Admin kan oppdatere andres profiler (rolle, visningsnavn).
-- Vanlige brukere kan fortsatt ikke endre egen rolle (004).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
