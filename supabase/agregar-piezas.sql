-- ============================================================================
-- ByFrame · alta de piezas
--
-- Ejecutar en el SQL Editor DESPUÉS de 0006_youtube.sql.
--
-- Tres piezas con archivo propio, ya transcodificadas y subidas a R2, y seis
-- alojadas en el canal del artista, que el sitio incrusta.
--
-- Todas van en 'horizontal': comparten pestaña, solo cambia el reproductor.
--
-- Las rutas se guardan en su forma canónica (media.byframe.co) aunque hoy se
-- sirvan desde la URL de desarrollo de R2: lib/media.ts traduce el origen en
-- tiempo de ejecución. Cuando exista el dominio no habrá que tocar ninguna fila.
--
-- Reejecutable: actualiza en vez de duplicar.
-- ============================================================================

insert into public.projects
  (slug, title, client, year, format, hls_url, poster_url, loop_url,
   youtube_id, duration, sort_order, published)
values
  -- ── Con archivo propio ────────────────────────────────────────────────────
  ('placeres', 'Placeres', 'Lowst', 2026, 'horizontal',
   'https://media.byframe.co/projects/placeres/hls/master.m3u8',
   'https://media.byframe.co/projects/placeres/poster.webp',
   'https://media.byframe.co/projects/placeres/loop.mp4',
   null, 176, 1, true),

  -- Título provisional: sale del nombre del archivo. Cámbialo desde el panel.
  ('enigma-ssb4', 'Enigma SSB4', null, 2026, 'horizontal',
   'https://media.byframe.co/projects/enigma-ssb4/hls/master.m3u8',
   'https://media.byframe.co/projects/enigma-ssb4/poster.webp',
   'https://media.byframe.co/projects/enigma-ssb4/loop.mp4',
   null, 142, 2, true),

  ('enigma-ssb5', 'Enigma SSB5', null, 2026, 'horizontal',
   'https://media.byframe.co/projects/enigma-ssb5/hls/master.m3u8',
   'https://media.byframe.co/projects/enigma-ssb5/poster.webp',
   'https://media.byframe.co/projects/enigma-ssb5/loop.mp4',
   null, 119, 3, true),

  -- ── Alojadas en YouTube ───────────────────────────────────────────────────
  -- Sin hls_url ni loop: el sitio incrusta el reproductor y usa la miniatura
  -- del video en la rejilla.
  ('100-noches-sin-vos', '100 Noches Sin Vos', 'Lowst', 2026, 'horizontal',
   null, null, null, 'JB3TOgOi7X4', null, 4, true),

  ('nebula', 'NEBULA', 'Lowst', 2026, 'horizontal',
   null, null, null, 'zpwwMBiGGLU', null, 5, true),

  ('fxma-mxta', 'FXMA MXTA', 'Yiduar', 2026, 'horizontal',
   null, null, null, 'TIUj23Y-Rcs', null, 6, true),

  ('hace-calor', 'Hace Calor', 'Yiduar x Auxone', 2026, 'horizontal',
   null, null, null, 'q4eBHmidw5Q', null, 7, true),

  ('huumo', 'Huumo', 'Icee Fran', 2026, 'horizontal',
   null, null, null, 'ofQ9ePGMFro', null, 8, true),

  ('se-trata-de-ti', 'Se trata de ti', 'Icee Fran', 2026, 'horizontal',
   null, null, null, 'MYngavdoowc', null, 9, true)

on conflict (slug) do update set
  title      = excluded.title,
  client     = excluded.client,
  year       = excluded.year,
  format     = excluded.format,
  hls_url    = excluded.hls_url,
  poster_url = excluded.poster_url,
  loop_url   = excluded.loop_url,
  youtube_id = excluded.youtube_id,
  duration   = excluded.duration,
  sort_order = excluded.sort_order,
  published  = excluded.published;

-- Bamboo abre el portafolio.
update public.projects set sort_order = 0 where slug = 'bamboo';

select slug, title, client, format,
       case when youtube_id is not null then 'YouTube' else 'propio' end as reproductor,
       published, sort_order
from public.projects
where deleted_at is null
order by format, sort_order;
