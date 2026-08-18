-- ============================================================================
-- ByFrame · supabase/tests/rls_checks.sql
--
-- Pruebas de Row Level Security. NO es una migración: se ejecuta a mano en el
-- SQL Editor de Supabase, después de 0005_seed.sql, y no modifica nada.
--
-- Cada bloque va dentro de begin/rollback. Eso importa por dos razones:
--   1. 'set local role' fuera de una transacción emite una advertencia y NO
--      cambia el rol. La prueba pasaría siempre sin probar nada.
--   2. Los bloques que intentan escribir revierten cualquier efecto.
--
-- Ejecuta los bloques UNO POR UNO. El SQL Editor de Supabase solo muestra el
-- resultado de la última sentencia cuando envías varias juntas.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 1 · El público no ve borradores
-- Esperado: 8 filas, todas con published = true.
--           NO deben aparecer 'demo-septiembre' ni 'demo-vertical-anden'.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  set local role anon;
  select slug, format, published
  from public.projects
  order by format, sort_order;
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 2 · La misma consulta como usuario autenticado
-- Esperado: 10 filas, incluidos los dos borradores.
-- Si esta devuelve 10 y la Prueba 1 devuelve 8, RLS está haciendo su trabajo.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  set local role authenticated;
  select slug, format, published
  from public.projects
  order by format, sort_order;
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 3 · Un borrador no es accesible ni pidiéndolo por slug
-- Esperado: 0 filas. Conocer el slug no debe servir de nada.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  set local role anon;
  select slug, title
  from public.projects
  where slug = 'demo-septiembre';
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 4 · La eliminación lógica oculta la fila del público
-- Marca un proyecto publicado como borrado, comprueba que desaparece, y
-- revierte. La base queda intacta.
-- Esperado: la primera consulta devuelve 1 fila; la segunda, 0.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  -- Estado inicial, visible para el público.
  set local role anon;
  select count(*) as antes from public.projects where slug = 'demo-cordillera';

  reset role;
  update public.projects set deleted_at = now() where slug = 'demo-cordillera';

  set local role anon;
  select count(*) as despues from public.projects where slug = 'demo-cordillera';
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 5 · Los créditos heredan la visibilidad del proyecto
-- Esperado: 0 filas. Los créditos de un borrador no se filtran.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  set local role anon;
  select c.role, c.name
  from public.project_credits c
  join public.projects p on p.id = c.project_id
  where p.slug = 'demo-septiembre';
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 6 · El público no puede escribir
-- Esperado: ERROR 42501 · "new row violates row-level security policy
--           for table projects".
-- Un error aquí es el resultado CORRECTO. Si la inserción funciona, falta la
-- migración 0004.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  set local role anon;
  insert into public.projects (slug, title, format, published)
  values ('demo-intruso', 'Intruso', 'horizontal', true);
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 7 · El público no puede modificar ni publicar
-- Esperado: 0 filas afectadas (UPDATE 0). RLS no lanza error en un UPDATE que
-- no encuentra filas visibles: simplemente no toca nada.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  set local role anon;
  update public.projects set published = true where slug = 'demo-septiembre';
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 8 · El público no puede borrar
-- Esperado: DELETE 0.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  set local role anon;
  delete from public.projects where slug = 'demo-culto-iii';
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 9 · El hero no filtra una pieza inédita
-- Apunta el hero a un borrador y sin video propio: el público deja de verlo.
-- Esperado: 0 filas.
-- ────────────────────────────────────────────────────────────────────────────
begin;
  update public.home_hero
  set project_id = (select id from public.projects where slug = 'demo-septiembre'),
      custom_video_url = null;

  set local role anon;
  select id, project_id from public.home_hero;
rollback;


-- ────────────────────────────────────────────────────────────────────────────
-- PRUEBA 10 · Inventario de políticas
-- Esperado: 10 filas, dos por tabla (una de lectura anon, una total
-- authenticated), y las cinco tablas con rowsecurity = true.
-- ────────────────────────────────────────────────────────────────────────────
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;
