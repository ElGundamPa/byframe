-- Ejecutar solo en una base de desarrollo después de 0007.
-- Las filas y el trigger de fallo se revierten al finalizar.
begin;

do $$
begin
  if has_function_privilege('anon', 'public.guardar_proyecto_con_creditos(jsonb,jsonb)', 'execute') then
    raise exception 'El público no debe poder ejecutar el guardado.';
  end if;
  if not has_function_privilege('authenticated', 'public.guardar_proyecto_con_creditos(jsonb,jsonb)', 'execute') then
    raise exception 'Un usuario autenticado debe poder ejecutar el guardado.';
  end if;
end;
$$;

create temporary table byframe_guardado_check (valor integer);
create function pg_temp.rechazar_credito_de_prueba()
returns trigger language plpgsql as $$
begin
  if new.name = '__rechazar_credito__' then
    raise exception 'Fallo de escritura simulado';
  end if;
  return new;
end;
$$;

create trigger byframe_rechazar_credito_de_prueba
before insert on public.project_credits
for each row execute function pg_temp.rechazar_credito_de_prueba();

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_proyecto jsonb := jsonb_build_object(
    'slug', 'prueba-guardado-' || gen_random_uuid()::text,
    'title', 'Título original', 'format', 'horizontal', 'published', false,
    'hls_url', '/media/prueba/master.m3u8', 'year', 2026
  );
  v_id uuid;
  v_resultado record;
  v_fallo boolean;
  v_slug_fallido text;
begin
  select * into v_resultado from public.guardar_proyecto_con_creditos(
    v_proyecto,
    '[{"role":" Dirección ","name":" Persona "},{"role":"Montaje","name":"Otra persona"}]'::jsonb
  );
  v_id := v_resultado.id;
  if v_id is null or v_resultado.published then
    raise exception 'No se devolvió el borrador creado.';
  end if;
  if (select count(*) from public.project_credits where project_id = v_id) <> 2
    or not exists (
      select 1 from public.project_credits
      where project_id = v_id and role = 'Dirección' and name = 'Persona' and sort_order = 0
    ) then
    raise exception 'Los créditos no se guardaron ordenados y normalizados.';
  end if;

  v_proyecto := v_proyecto || jsonb_build_object('id', v_id, 'published', true);
  select * into v_resultado from public.guardar_proyecto_con_creditos(
    v_proyecto, '[{"role":"Dirección","name":"Persona"}]'::jsonb
  );
  if not v_resultado.published
    or (select count(*) from public.project_credits where project_id = v_id) <> 1 then
    raise exception 'No se publicó o no se sustituyeron los créditos.';
  end if;

  -- El trigger falla DESPUÉS del UPDATE y del DELETE. Ambos deben revertirse.
  v_fallo := false;
  begin
    perform public.guardar_proyecto_con_creditos(
      v_proyecto || '{"title":"No debe persistir"}'::jsonb,
      '[{"role":"Dirección","name":"__rechazar_credito__"}]'::jsonb
    );
  exception when raise_exception then
    v_fallo := true;
  end;
  if not v_fallo
    or (select title from public.projects where id = v_id) <> 'Título original'
    or (select count(*) from public.project_credits where project_id = v_id and name = 'Persona') <> 1 then
    raise exception 'Un fallo de créditos dejó cambios parciales.';
  end if;

  -- Tampoco debe quedar un proyecto nuevo huérfano si fallan sus créditos.
  v_slug_fallido := 'prueba-fallida-' || gen_random_uuid()::text;
  v_fallo := false;
  begin
    perform public.guardar_proyecto_con_creditos(
      (v_proyecto - 'id') || jsonb_build_object('slug', v_slug_fallido),
      '[{"role":"Dirección","name":"__rechazar_credito__"}]'::jsonb
    );
  exception when raise_exception then
    v_fallo := true;
  end;
  if not v_fallo or exists (select 1 from public.projects where slug = v_slug_fallido) then
    raise exception 'Un alta fallida dejó un proyecto sin créditos.';
  end if;

  v_fallo := false;
  begin
    perform public.guardar_proyecto_con_creditos(v_proyecto - 'id', '[]'::jsonb);
  exception when unique_violation then
    v_fallo := true;
  end;
  if not v_fallo then raise exception 'Se aceptó un slug duplicado.'; end if;

  v_fallo := false;
  begin
    perform public.guardar_proyecto_con_creditos(
      v_proyecto || jsonb_build_object('id', gen_random_uuid()), '[]'::jsonb
    );
  exception when no_data_found then
    v_fallo := true;
  end;
  if not v_fallo then raise exception 'Se anunció el guardado de un ID inexistente.'; end if;

  -- Las restricciones existentes siguen actuando dentro del guardado atómico.
  v_fallo := false;
  begin
    perform public.guardar_proyecto_con_creditos(
      v_proyecto || '{"hls_url":null,"youtube_id":null,"published":true}'::jsonb,
      '[]'::jsonb
    );
  exception when check_violation then
    v_fallo := true;
  end;
  if not v_fallo then raise exception 'Se publicó un proyecto sin video.'; end if;

  select * into v_resultado from public.guardar_proyecto_con_creditos(
    v_proyecto || '{"published":false}'::jsonb, '[]'::jsonb
  );
  if v_resultado.published
    or exists (select 1 from public.project_credits where project_id = v_id) then
    raise exception 'No se guardó el borrador sin créditos.';
  end if;

  update public.projects set deleted_at = now() where id = v_id;
  v_fallo := false;
  begin
    perform public.guardar_proyecto_con_creditos(v_proyecto, '[]'::jsonb);
  exception when no_data_found then
    v_fallo := true;
  end;
  if not v_fallo then raise exception 'Se modificó un proyecto en la papelera.'; end if;
end;
$$;

-- Tener el rol authenticated sin usuario válido no basta.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
do $$
declare
  v_fallo boolean := false;
begin
  begin
    perform public.guardar_proyecto_con_creditos('{}'::jsonb, '[]'::jsonb);
  exception when insufficient_privilege then
    v_fallo := true;
  end;
  if not v_fallo then raise exception 'Se permitió guardar sin sesión válida.'; end if;
end;
$$;

select 'Guardado, sustitución, rollback, publicación y permisos: correctos.' as resultado;
rollback;
