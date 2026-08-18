-- ============================================================================
-- ByFrame · 0002_indexes.sql
-- Índices. Depende de 0001_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------

-- El unique de la columna slug ya crea un índice; no hace falta duplicarlo.
-- Lo que sí conviene es un índice parcial para la búsqueda por slug del sitio
-- público, que siempre filtra por publicado y no borrado.
create index if not exists projects_slug_publico_idx
  on public.projects (slug)
  where published = true and deleted_at is null;

-- Consulta principal del portafolio: "dame los horizontales publicados en
-- orden". Cubre el filtro y el orden de una sola pasada.
create index if not exists projects_formato_orden_idx
  on public.projects (format, sort_order)
  where published = true and deleted_at is null;

-- Listado del panel, que sí ve borradores y ordena por fecha.
create index if not exists projects_publicados_idx
  on public.projects (published, created_at desc)
  where deleted_at is null;

-- Filtro habitual del panel para revisar la papelera.
create index if not exists projects_borrados_idx
  on public.projects (deleted_at)
  where deleted_at is not null;

-- ----------------------------------------------------------------------------
-- project_credits
-- ----------------------------------------------------------------------------

-- Los créditos siempre se piden por proyecto y en orden.
create index if not exists project_credits_proyecto_orden_idx
  on public.project_credits (project_id, sort_order);

-- ----------------------------------------------------------------------------
-- team_members
-- ----------------------------------------------------------------------------

create index if not exists team_members_orden_idx
  on public.team_members (sort_order);

-- ----------------------------------------------------------------------------
-- home_hero
-- ----------------------------------------------------------------------------

create index if not exists home_hero_proyecto_idx
  on public.home_hero (project_id);

-- site_settings no lleva índice adicional: el unique de key ya lo cubre y la
-- tabla nunca pasará de una docena de filas.
