-- Gi anon/authenticated tilgang til tabellene (trengs hvis migreringer ble kjørt utenfor Dashboard)
-- Kjør i Supabase SQL Editor hvis du får "permission denied for table app_data"

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

grant select on public.app_data to authenticated;
grant insert, update, delete on public.app_data to authenticated;
