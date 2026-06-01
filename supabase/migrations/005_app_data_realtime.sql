-- Aktiver Supabase Realtime på app_data (felles synk mellom brukere).
-- Kjør i SQL Editor etter 002_app_data.sql hvis tabellen allerede finnes.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_data'
  ) then
    alter publication supabase_realtime add table public.app_data;
  end if;
end $$;
