-- Blokker rolle-eskalering: innloggede brukere kan ikke endre egen role via UPDATE.
-- Uten denne sjekken tillot profiles_update_own at auth.uid() satte role = 'admin'.
-- Rolleendring gjøres kun av admin i Supabase-dashbord eller via service role.

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );
