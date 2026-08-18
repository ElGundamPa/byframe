-- ============================================================================
-- ByFrame · 0004_rls.sql
-- Row Level Security. Depende de 0001_schema.sql.
--
-- Modelo de acceso, en dos frases:
--   · El rol anon (la llave pública que viaja al navegador) solo puede LEER, y
--     solo lo publicado y no borrado.
--   · El rol authenticated (los dos socios, tras iniciar sesión) puede leer y
--     escribir todo, incluidos los borradores.
--
-- El rol service_role ignora RLS por diseño de Postgres: las políticas de este
-- archivo no lo afectan. Por eso esa llave jamás sale del servidor.
-- ============================================================================

alter table public.projects        enable row level security;
alter table public.project_credits enable row level security;
alter table public.team_members    enable row level security;
alter table public.site_settings   enable row level security;
alter table public.home_hero       enable row level security;

-- Nota sobre 'force row level security': no se activa a propósito. Forzarlo
-- sujetaría también al rol dueño de las tablas, que es el mismo con el que
-- corre el SQL Editor, y la migración de datos de ejemplo (0005) fallaría sin
-- un motivo real. Para probar el comportamiento del público no hace falta:
-- basta con cambiar de rol dentro de una transacción, como hace
-- supabase/tests/rls_checks.sql.

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------

drop policy if exists projects_lectura_publica on public.projects;
create policy projects_lectura_publica
  on public.projects
  for select
  to anon
  using (published = true and deleted_at is null);

drop policy if exists projects_acceso_total_autenticado on public.projects;
create policy projects_acceso_total_autenticado
  on public.projects
  for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- project_credits · heredan la visibilidad de su proyecto
-- ----------------------------------------------------------------------------
-- Sin esta condición, un curioso podría enumerar los créditos de un proyecto
-- inédito y deducir en qué está trabajando la productora.

drop policy if exists project_credits_lectura_publica on public.project_credits;
create policy project_credits_lectura_publica
  on public.project_credits
  for select
  to anon
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_credits.project_id
        and p.published = true
        and p.deleted_at is null
    )
  );

drop policy if exists project_credits_acceso_total_autenticado on public.project_credits;
create policy project_credits_acceso_total_autenticado
  on public.project_credits
  for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- team_members
-- ----------------------------------------------------------------------------
-- No tienen estado de publicación: todo perfil cargado es público. Si más
-- adelante hacen falta perfiles ocultos, se agrega una columna 'published' y
-- se ajusta esta política.

drop policy if exists team_members_lectura_publica on public.team_members;
create policy team_members_lectura_publica
  on public.team_members
  for select
  to anon
  using (true);

drop policy if exists team_members_acceso_total_autenticado on public.team_members;
create policy team_members_acceso_total_autenticado
  on public.team_members
  for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- site_settings
-- ----------------------------------------------------------------------------
-- Contiene correo, WhatsApp y redes: información que el sitio muestra de todas
-- formas en la página de contacto. No guardes aquí nada privado.

drop policy if exists site_settings_lectura_publica on public.site_settings;
create policy site_settings_lectura_publica
  on public.site_settings
  for select
  to anon
  using (true);

drop policy if exists site_settings_acceso_total_autenticado on public.site_settings;
create policy site_settings_acceso_total_autenticado
  on public.site_settings
  for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- home_hero
-- ----------------------------------------------------------------------------
-- Si el hero apunta a un proyecto, ese proyecto debe estar publicado; si trae
-- video propio, es visible sin más. Así, asignar un borrador al hero no lo
-- filtra al público: la portada cae al video propio o queda sin fuente, pero
-- nunca revela la pieza inédita.

drop policy if exists home_hero_lectura_publica on public.home_hero;
create policy home_hero_lectura_publica
  on public.home_hero
  for select
  to anon
  using (
    custom_video_url is not null
    or exists (
      select 1
      from public.projects p
      where p.id = home_hero.project_id
        and p.published = true
        and p.deleted_at is null
    )
  );

drop policy if exists home_hero_acceso_total_autenticado on public.home_hero;
create policy home_hero_acceso_total_autenticado
  on public.home_hero
  for all
  to authenticated
  using (true)
  with check (true);
