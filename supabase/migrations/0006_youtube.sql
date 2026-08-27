-- ============================================================================
-- ByFrame · 0006_youtube.sql
--
-- Piezas alojadas en YouTube.
--
-- Algunas piezas no las distribuye ByFrame: viven en el canal del artista. Para
-- esas se guarda el id del video y el sitio incrusta el reproductor, en vez de
-- alojar una copia. Descargar el archivo de YouTube va contra sus condiciones,
-- y además las reproducciones tienen que contar en el canal de quien publicó
-- la pieza.
--
-- Depende de 0001_schema.sql.
-- ============================================================================

alter table public.projects
  add column if not exists youtube_id text;

comment on column public.projects.youtube_id is
  'Id de 11 caracteres del video en YouTube. Si está presente y no hay hls_url, el sitio incrusta el reproductor de YouTube.';

-- Once caracteres del alfabeto seguro para URL. Guardar aquí una URL entera en
-- vez del id es el error fácil, y produce una incrustación rota sin ningún
-- mensaje: la restricción lo impide en el momento de escribir.
alter table public.projects
  drop constraint if exists projects_youtube_id_formato;

alter table public.projects
  add constraint projects_youtube_id_formato
  check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$');

-- Una pieza tiene que poder reproducirse de alguna forma para estar publicada:
-- o manifiesto propio, o video de YouTube. Publicar una sin ninguno de los dos
-- deja una ficha con un hueco negro.
alter table public.projects
  drop constraint if exists projects_publicado_tiene_video;

alter table public.projects
  add constraint projects_publicado_tiene_video
  check (published = false or hls_url is not null or youtube_id is not null);
