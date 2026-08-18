-- ============================================================================
-- ByFrame · 0005_seed.sql
-- Datos de ejemplo. Depende de 0001 a 0004.
--
-- Todas las URLs son marcadores de posición: apuntan a media.byframe.co pero
-- esos archivos aún no existen. Los posters se verán rotos hasta que subas
-- material real con scripts/transcode.mjs (Fase 3). Es lo esperado.
--
-- Todos los slugs llevan el prefijo 'demo-' para poder borrarlos de un golpe.
-- Este archivo es reejecutable: no duplica filas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- projects · 6 horizontales y 4 verticales
-- ----------------------------------------------------------------------------
-- Dos quedan como borrador a propósito: son la prueba viva de que RLS funciona.
-- Si alguna vez los ves en el sitio público, hay algo mal.

insert into public.projects
  (slug, title, client, year, format, description, hls_url, poster_url, loop_url, duration, sort_order, published)
values
  ('demo-culto-iii', 'Culto III', 'Bavaria', 2025, 'horizontal',
   'Pieza de marca rodada en película, con laboratorio digital de alto contraste. Locación: Salar de Uyuni.',
   'https://media.byframe.co/projects/demo-culto-iii/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-culto-iii/poster.webp',
   'https://media.byframe.co/projects/demo-culto-iii/loop.mp4',
   142, 1, true),

  ('demo-noche-abierta', 'Noche abierta', 'Águila', 2025, 'horizontal',
   'Comercial nocturno de treinta segundos, luz practicable y cámara en mano.',
   'https://media.byframe.co/projects/demo-noche-abierta/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-noche-abierta/poster.webp',
   'https://media.byframe.co/projects/demo-noche-abierta/loop.mp4',
   30, 2, true),

  ('demo-cordillera', 'Cordillera', 'Juan Valdez', 2024, 'horizontal',
   'Documental de marca sobre caficultores del Huila. Rodaje de nueve días.',
   'https://media.byframe.co/projects/demo-cordillera/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-cordillera/poster.webp',
   'https://media.byframe.co/projects/demo-cordillera/loop.mp4',
   224, 3, true),

  ('demo-materia-prima', 'Materia prima', 'Corona', 2024, 'horizontal',
   'Serie de tres piezas sobre oficios del barro en Ráquira.',
   'https://media.byframe.co/projects/demo-materia-prima/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-materia-prima/poster.webp',
   'https://media.byframe.co/projects/demo-materia-prima/loop.mp4',
   96, 4, true),

  ('demo-ruido-blanco', 'Ruido blanco', 'Claro', 2024, 'horizontal',
   'Lanzamiento de producto con animación integrada en cámara.',
   'https://media.byframe.co/projects/demo-ruido-blanco/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-ruido-blanco/poster.webp',
   'https://media.byframe.co/projects/demo-ruido-blanco/loop.mp4',
   45, 5, true),

  -- Borrador: en proceso, no debe verse en el sitio público.
  ('demo-septiembre', 'Septiembre', 'Postobón', 2026, 'horizontal',
   'Campaña en montaje. Estreno previsto para el segundo semestre.',
   'https://media.byframe.co/projects/demo-septiembre/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-septiembre/poster.webp',
   'https://media.byframe.co/projects/demo-septiembre/loop.mp4',
   60, 6, false),

  ('demo-vertical-pulso', 'Pulso', 'Adidas', 2025, 'vertical',
   'Pieza para redes, formato 9:16, corte rápido.',
   'https://media.byframe.co/projects/demo-vertical-pulso/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-vertical-pulso/poster.webp',
   'https://media.byframe.co/projects/demo-vertical-pulso/loop.mp4',
   18, 1, true),

  ('demo-vertical-mercado', 'Mercado', 'Rappi', 2025, 'vertical',
   'Serie de seis cápsulas verticales rodadas en la Plaza de Paloquemao.',
   'https://media.byframe.co/projects/demo-vertical-mercado/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-vertical-mercado/poster.webp',
   'https://media.byframe.co/projects/demo-vertical-mercado/loop.mp4',
   22, 2, true),

  ('demo-vertical-brasa', 'Brasa', 'Frisby', 2024, 'vertical',
   'Producto en cámara lenta, iluminación dura, fondo negro.',
   'https://media.byframe.co/projects/demo-vertical-brasa/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-vertical-brasa/poster.webp',
   'https://media.byframe.co/projects/demo-vertical-brasa/loop.mp4',
   15, 3, true),

  -- Segundo borrador.
  ('demo-vertical-anden', 'Andén', 'Totto', 2026, 'vertical',
   'Prueba de dirección de arte para campaña de temporada.',
   'https://media.byframe.co/projects/demo-vertical-anden/hls/master.m3u8',
   'https://media.byframe.co/projects/demo-vertical-anden/poster.webp',
   'https://media.byframe.co/projects/demo-vertical-anden/loop.mp4',
   20, 4, false)

on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- project_credits
-- ----------------------------------------------------------------------------
-- Se limpian primero los créditos de ejemplo para que reejecutar este archivo
-- no los duplique.

delete from public.project_credits
where project_id in (select id from public.projects where slug like 'demo-%');

insert into public.project_credits (project_id, role, name, sort_order)
select p.id, c.role, c.name, c.sort_order
from public.projects p
cross join lateral (
  values
    ('Dirección',                 'Nombre Apellido Uno', 1),
    ('Dirección de fotografía',   'Nombre Apellido Dos', 2),
    ('Producción ejecutiva',      'Nombre Apellido Uno', 3),
    ('Montaje',                   'Nombre Apellido Dos', 4),
    ('Corrección de color',       'Nombre Apellido Tres', 5)
) as c(role, name, sort_order)
where p.slug like 'demo-%';

-- ----------------------------------------------------------------------------
-- team_members · los dos socios
-- ----------------------------------------------------------------------------
-- Nombres de marcador de posición a propósito: reemplázalos desde el panel.

insert into public.team_members (name, role, bio, photo_url, links, sort_order)
select * from (values
  ('Nombre Apellido Uno', 'Dirección',
   'Biografía corta de dos o tres líneas. Reemplaza este texto desde el panel, en la sección Equipo.',
   'https://media.byframe.co/team/socio-uno.webp',
   '{"instagram": "https://instagram.com/byframe", "vimeo": "https://vimeo.com/byframe"}'::jsonb,
   1),
  ('Nombre Apellido Dos', 'Dirección de fotografía',
   'Biografía corta de dos o tres líneas. Reemplaza este texto desde el panel, en la sección Equipo.',
   'https://media.byframe.co/team/socio-dos.webp',
   '{"instagram": "https://instagram.com/byframe"}'::jsonb,
   2)
) as nuevos(name, role, bio, photo_url, links, sort_order)
where not exists (
  select 1 from public.team_members where name = nuevos.name
);

-- ----------------------------------------------------------------------------
-- site_settings
-- ----------------------------------------------------------------------------
-- Estructura de cada clave. El panel (Fase 4) edita estos mismos objetos.

insert into public.site_settings (key, value) values
  ('contacto', '{
     "email": "hola@byframe.co",
     "whatsapp": "+57 300 000 0000",
     "ciudad": "Bogotá, Colombia"
   }'::jsonb),

  ('redes', '{
     "instagram": "https://instagram.com/byframe",
     "vimeo": "https://vimeo.com/byframe",
     "youtube": null
   }'::jsonb),

  ('nosotros', '{
     "titulo": "Nosotros",
     "texto": "ByFrame es una productora audiovisual colombiana. Reemplaza este texto desde el panel."
   }'::jsonb),

  ('seo', '{
     "title": "ByFrame — Productora audiovisual",
     "description": "Portafolio de comerciales y piezas para redes.",
     "og_image": "https://media.byframe.co/site/og.jpg"
   }'::jsonb)

on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- home_hero · una sola fila
-- ----------------------------------------------------------------------------
-- Apunta al primer proyecto publicado y trae además un poster de respaldo.

insert into public.home_hero (project_id, custom_poster_url, overlay_text)
select p.id,
       'https://media.byframe.co/site/hero-poster.webp',
       'ByFrame'
from public.projects p
where p.slug = 'demo-culto-iii'
  and not exists (select 1 from public.home_hero);
