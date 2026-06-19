-- Admin-operasjoner (invitasjon, import brukere) bruker service role.
-- Kjør i SQL Editor hvis du får «permission denied for table profiles».

grant select, insert, update on public.profiles to service_role;
