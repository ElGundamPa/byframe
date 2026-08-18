-- ============================================================================
-- ByFrame · 0001_schema.sql
-- Tablas, tipos y restricciones. Debe ejecutarse primero.
-- ============================================================================

-- gen_random_uuid() es parte del núcleo de Postgres desde la versión 13,
-- que es anterior a cualquier proyecto nuevo de Supabase. No hace falta
-- instalar pgcrypto.

-- ----------------------------------------------------------------------------
-- projects · una fila por pieza del portafolio
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),

  -- slug: identificador legible que viaja en la URL pública y en la ruta de R2
  -- (/projects/{slug}/). Único e inmutable en la práctica: cambiarlo obliga a
  -- mover los archivos en el bucket.
  slug        text not null unique,

  title       text not null,
  client      text,

  -- Año de realización. El límite inferior evita errores de digitación tipo 201.
  year        int  check (year between 1990 and 2100),

  -- Determina en qué pestaña del sitio aparece la pieza y qué escalera de
  -- transcodificación usó el script de la Fase 3.
  format      text not null check (format in ('horizontal', 'vertical')),

  description text,

  -- Rutas absolutas en media.byframe.co. Se pegan tal como las imprime
  -- scripts/transcode.mjs. Un borrador puede existir sin ellas.
  hls_url     text,
  poster_url  text,
  loop_url    text,

  -- Duración en segundos enteros.
  duration    int check (duration >= 0),

  -- Orden manual dentro de su formato. Se persiste desde el panel con dnd-kit.
  sort_order  int not null default 0,

  published   boolean not null default false,

  -- Eliminación lógica. Nunca se borran filas físicamente: el material
  -- audiovisual es difícil de reponer y un borrado accidental sería caro.
  deleted_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Un slug vacío rompería las URLs sin dar ningún error visible.
  constraint projects_slug_no_vacio check (length(trim(slug)) > 0),

  -- El slug debe ser seguro para URL y para rutas de objeto en R2.
  constraint projects_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table  public.projects            is 'Piezas del portafolio de ByFrame.';
comment on column public.projects.deleted_at is 'Eliminación lógica. Si no es nulo, la fila es invisible en el sitio público.';
comment on column public.projects.hls_url    is 'Manifiesto .m3u8 en media.byframe.co, generado por scripts/transcode.mjs.';

-- ----------------------------------------------------------------------------
-- project_credits · créditos del equipo, uno por línea
-- ----------------------------------------------------------------------------
create table if not exists public.project_credits (
  id         uuid primary key default gen_random_uuid(),

  -- Si el proyecto se borra de verdad (solo por mantenimiento manual), sus
  -- créditos se van con él.
  project_id uuid not null references public.projects (id) on delete cascade,

  -- Ejemplos: 'Dirección', 'Dirección de fotografía', 'Montaje'.
  role       text not null,
  name       text not null,

  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_credits is 'Créditos mostrados bajo el video en la vista de detalle.';

-- ----------------------------------------------------------------------------
-- team_members · perfiles de la sección Nosotros
-- ----------------------------------------------------------------------------
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,
  bio        text,

  -- Foto vertical, en blanco y negro, servida desde media.byframe.co.
  photo_url  text,

  -- Enlaces sociales del perfil. Estructura esperada:
  --   {"instagram": "https://...", "vimeo": "https://...", "linkedin": "https://..."}
  links      jsonb not null default '{}'::jsonb,

  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- jsonb admite arreglos y escalares; aquí solo tiene sentido un objeto.
  constraint team_members_links_es_objeto check (jsonb_typeof(links) = 'object')
);

comment on table public.team_members is 'Perfiles de la sección Nosotros.';

-- ----------------------------------------------------------------------------
-- site_settings · pares clave/valor editables desde el panel
-- ----------------------------------------------------------------------------
-- Se modela como clave/valor y no como una fila única de muchas columnas para
-- poder agregar ajustes en la Fase 4 sin escribir una migración nueva.
create table if not exists public.site_settings (
  id         uuid primary key default gen_random_uuid(),

  -- Claves previstas: 'contacto', 'redes', 'nosotros', 'seo'.
  key        text not null unique,
  value      jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint site_settings_key_no_vacio check (length(trim(key)) > 0)
);

comment on table public.site_settings is 'Ajustes globales del sitio, en pares clave/valor.';

-- ----------------------------------------------------------------------------
-- home_hero · el video de portada
-- ----------------------------------------------------------------------------
-- El hero puede apuntar a un proyecto existente o traer rutas propias de una
-- pieza dedicada que no figura en el portafolio.
create table if not exists public.home_hero (
  id                 uuid primary key default gen_random_uuid(),

  -- Si el proyecto de origen se borra físicamente, el hero no debe morir con
  -- él: queda en null y el panel muestra que hay que reasignarlo.
  project_id         uuid references public.projects (id) on delete set null,

  custom_video_url   text,
  custom_poster_url  text,
  overlay_text       text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- O se hereda de un proyecto, o se define una pieza propia. Un hero sin
  -- ninguna de las dos cosas dejaría la portada en negro.
  constraint home_hero_tiene_fuente check (
    project_id is not null or custom_video_url is not null
  )
);

comment on table public.home_hero is 'Video de portada. Se espera una sola fila activa.';

-- Solo debe existir un hero. Un índice único sobre una expresión constante es
-- la forma más simple de forzarlo sin agregar una columna artificial.
create unique index if not exists home_hero_fila_unica on public.home_hero ((true));
