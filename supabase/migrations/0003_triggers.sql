-- ============================================================================
-- ByFrame · 0003_triggers.sql
-- Mantenimiento automático de updated_at. Depende de 0001_schema.sql.
-- ============================================================================

-- La función es 'security definer' con search_path fijo por costumbre de
-- seguridad: evita que un search_path manipulado apunte a otro esquema.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  -- created_at no se puede reescribir desde el cliente. Si alguien lo intenta,
  -- se conserva el valor original en lugar de fallar la escritura.
  new.created_at = old.created_at;
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Fija updated_at = now() y protege created_at en cada UPDATE.';

-- ----------------------------------------------------------------------------
-- Un disparador por tabla. Se recrean para que la migración sea reejecutable.
-- ----------------------------------------------------------------------------

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists project_credits_set_updated_at on public.project_credits;
create trigger project_credits_set_updated_at
  before update on public.project_credits
  for each row execute function public.set_updated_at();

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

drop trigger if exists home_hero_set_updated_at on public.home_hero;
create trigger home_hero_set_updated_at
  before update on public.home_hero
  for each row execute function public.set_updated_at();
