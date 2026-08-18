-- ============================================================================
-- Alta del proyecto "Bamboo" y asignación al hero.
--
-- Se ejecuta a mano en el SQL Editor de Supabase mientras el panel (Fase 4) no
-- exista. Después, esto mismo se hará desde el formulario.
--
-- Las rutas se guardan con la forma canónica (https://media.byframe.co/...)
-- aunque hoy el video se sirva desde public/media: lib/media.ts traduce el
-- origen en tiempo de ejecución según NEXT_PUBLIC_MEDIA_BASE_URL. Así, cuando
-- exista el bucket, no hay que tocar ni una fila.
--
-- Es reejecutable: no duplica nada.
-- ============================================================================

-- ── El proyecto ─────────────────────────────────────────────────────────────
insert into public.projects
  (slug, title, client, year, format, description,
   hls_url, poster_url, loop_url, duration, sort_order, published)
values
  ('bamboo',
   'Bamboo',
   null,                        -- cliente: rellénalo cuando lo tengas
   2026,
   'horizontal',
   null,                        -- descripción
   'https://media.byframe.co/projects/bamboo/hls/master.m3u8',
   'https://media.byframe.co/projects/bamboo/poster.webp',
   'https://media.byframe.co/projects/bamboo/loop.mp4',
   177,
   0,                           -- 0 lo deja primero en la rejilla
   true)
on conflict (slug) do update set
  title      = excluded.title,
  format     = excluded.format,
  hls_url    = excluded.hls_url,
  poster_url = excluded.poster_url,
  loop_url   = excluded.loop_url,
  duration   = excluded.duration,
  published  = excluded.published;

-- ── El hero apunta a Bamboo ─────────────────────────────────────────────────
-- Se limpia custom_video_url para que la portada herede el material del
-- proyecto en vez de una pieza dedicada.
update public.home_hero
set project_id        = (select id from public.projects where slug = 'bamboo'),
    custom_video_url  = null,
    custom_poster_url = null,
    overlay_text      = 'ByFrame';

-- ── Comprobación ────────────────────────────────────────────────────────────
select slug, title, format, published, duration
from public.projects
where slug = 'bamboo';
