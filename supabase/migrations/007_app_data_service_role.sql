-- Infoskjerm leser app_data med service role (uten innlogging).
-- Kjør i SQL Editor hvis infoskjerm viser «Kunne ikke hente data».

grant select on public.app_data to service_role;
