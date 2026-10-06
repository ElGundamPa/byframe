-- Guarda el proyecto y sus créditos en una sola transacción.
-- Aplicar después de 0006_youtube.sql, antes de desplegar el nuevo administrador.
-- No modifica los proyectos existentes al instalarse.

create or replace function public.guardar_proyecto_con_creditos(
  p_proyecto jsonb,
  p_creditos jsonb
)
returns table (id uuid, slug text, published boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_guardado public.projects%rowtype;
begin
  -- La función usa la sesión del cliente y las políticas RLS existentes.
  if auth.uid() is null then
    raise exception 'Se necesita una sesión válida.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_proyecto) is distinct from 'object'
    or jsonb_typeof(p_creditos) is distinct from 'array' then
    raise exception 'Datos de proyecto o créditos no válidos.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_creditos) > 60 then
    raise exception 'El máximo es 60 créditos.' using errcode = '22023';
  end if;

  if nullif(btrim(p_proyecto ->> 'title'), '') is null then
    raise exception 'El título es obligatorio.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_creditos) as credito(value)
    where jsonb_typeof(credito.value) is distinct from 'object'
      or nullif(btrim(credito.value ->> 'role'), '') is null
      or nullif(btrim(credito.value ->> 'name'), '') is null
  ) then
    raise exception 'Cada crédito necesita un rol y un nombre.' using errcode = '23514';
  end if;

  v_id := nullif(p_proyecto ->> 'id', '')::uuid;

  if v_id is null then
    insert into public.projects (
      slug, title, client, year, format, description,
      hls_url, poster_url, loop_url, youtube_id, duration, published
    ) values (
      p_proyecto ->> 'slug',
      btrim(p_proyecto ->> 'title'),
      nullif(btrim(p_proyecto ->> 'client'), ''),
      (p_proyecto ->> 'year')::integer,
      p_proyecto ->> 'format',
      nullif(btrim(p_proyecto ->> 'description'), ''),
      nullif(btrim(p_proyecto ->> 'hls_url'), ''),
      nullif(btrim(p_proyecto ->> 'poster_url'), ''),
      nullif(btrim(p_proyecto ->> 'loop_url'), ''),
      nullif(btrim(p_proyecto ->> 'youtube_id'), ''),
      (p_proyecto ->> 'duration')::integer,
      (p_proyecto ->> 'published')::boolean
    ) returning projects.* into v_guardado;
  else
    -- El UPDATE bloquea la fila: otro guardado del mismo proyecto espera a que
    -- termine también la sustitución de sus créditos.
    update public.projects as proyecto set
      slug = p_proyecto ->> 'slug',
      title = btrim(p_proyecto ->> 'title'),
      client = nullif(btrim(p_proyecto ->> 'client'), ''),
      year = (p_proyecto ->> 'year')::integer,
      format = p_proyecto ->> 'format',
      description = nullif(btrim(p_proyecto ->> 'description'), ''),
      hls_url = nullif(btrim(p_proyecto ->> 'hls_url'), ''),
      poster_url = nullif(btrim(p_proyecto ->> 'poster_url'), ''),
      loop_url = nullif(btrim(p_proyecto ->> 'loop_url'), ''),
      youtube_id = nullif(btrim(p_proyecto ->> 'youtube_id'), ''),
      duration = (p_proyecto ->> 'duration')::integer,
      published = (p_proyecto ->> 'published')::boolean
    where proyecto.id = v_id and proyecto.deleted_at is null
    returning proyecto.* into v_guardado;

    if not found then
      raise exception 'El proyecto no existe o está en la papelera.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.project_credits as credito
  where credito.project_id = v_guardado.id;

  insert into public.project_credits (project_id, role, name, sort_order)
  select v_guardado.id,
    btrim(credito.value ->> 'role'),
    btrim(credito.value ->> 'name'),
    (credito.ordinality - 1)::integer
  from jsonb_array_elements(p_creditos) with ordinality as credito(value, ordinality);

  -- Cualquier error anterior revierte toda la llamada, incluido el DELETE.
  return query select v_guardado.id, v_guardado.slug, v_guardado.published;
end;
$$;

revoke all on function public.guardar_proyecto_con_creditos(jsonb, jsonb) from public;
revoke all on function public.guardar_proyecto_con_creditos(jsonb, jsonb) from anon;
grant execute on function public.guardar_proyecto_con_creditos(jsonb, jsonb) to authenticated;

comment on function public.guardar_proyecto_con_creditos(jsonb, jsonb) is
  'Guardado atómico de proyecto y créditos. Respeta la sesión y las políticas RLS.';

notify pgrst, 'reload schema';
