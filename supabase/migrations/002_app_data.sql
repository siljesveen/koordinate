-- Felles lagring for KOordinate (speiler localStorage-nøkler som JSON)
-- Kjør i SQL Editor etter 001_profiles.sql

create table if not exists public.app_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists app_data_updated_at_idx on public.app_data (updated_at desc);

alter table public.app_data enable row level security;

drop policy if exists "app_data_select_authenticated" on public.app_data;
create policy "app_data_select_authenticated"
  on public.app_data for select
  to authenticated
  using (true);

drop policy if exists "app_data_write_planlegger_admin" on public.app_data;
create policy "app_data_write_planlegger_admin"
  on public.app_data for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'planlegger')
    )
  );

drop policy if exists "app_data_update_planlegger_admin" on public.app_data;
create policy "app_data_update_planlegger_admin"
  on public.app_data for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'planlegger')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'planlegger')
    )
  );

drop policy if exists "app_data_delete_planlegger_admin" on public.app_data;
create policy "app_data_delete_planlegger_admin"
  on public.app_data for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'planlegger')
    )
  );
