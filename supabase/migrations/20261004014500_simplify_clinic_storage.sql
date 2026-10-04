create or replace function public.save_exam_location(p_location_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_location_id uuid;
  v_company_id uuid;
  v_item jsonb;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'master'::public.app_role) then
    raise exception 'Acesso não autorizado';
  end if;

  if nullif(trim(p_data->>'name'), '') is null
     or nullif(trim(p_data->>'street'), '') is null
     or nullif(trim(p_data->>'city'), '') is null
     or length(trim(p_data->>'state')) <> 2 then
    raise exception 'Preencha nome, endereço, cidade e UF da clínica';
  end if;

  if p_location_id is null then
    insert into public.exam_locations (
      name, street, number, complement, district, city, state, postal_code, phone, created_by, is_active
    )
    values (
      trim(p_data->>'name'), trim(p_data->>'street'),
      nullif(trim(p_data->>'number'), ''), nullif(trim(p_data->>'complement'), ''),
      nullif(trim(p_data->>'district'), ''), trim(p_data->>'city'),
      upper(trim(p_data->>'state')), nullif(trim(p_data->>'postal_code'), ''),
      nullif(trim(p_data->>'phone'), ''), v_user_id, true
    )
    returning id into v_location_id;
  else
    update public.exam_locations
       set name = trim(p_data->>'name'),
           street = trim(p_data->>'street'),
           number = nullif(trim(p_data->>'number'), ''),
           complement = nullif(trim(p_data->>'complement'), ''),
           district = nullif(trim(p_data->>'district'), ''),
           city = trim(p_data->>'city'),
           state = upper(trim(p_data->>'state')),
           postal_code = nullif(trim(p_data->>'postal_code'), ''),
           phone = nullif(trim(p_data->>'phone'), ''),
           is_active = true,
           updated_at = now()
     where id = p_location_id
     returning id into v_location_id;

    if v_location_id is null then raise exception 'Clínica não encontrada'; end if;

    delete from public.exam_location_companies where location_id = v_location_id;
    delete from public.exam_location_schedule_rules where location_id = v_location_id;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_data->'company_ids','[]'::jsonb))
  loop
    v_company_id := (v_item #>> '{}')::uuid;
    if not exists (select 1 from public.companies c where c.id = v_company_id and c.status = 'approved') then
      raise exception 'Empresa inválida ou não aprovada';
    end if;
    insert into public.exam_location_companies(location_id, company_id)
    values (v_location_id, v_company_id);
  end loop;

  if not exists (select 1 from public.exam_location_companies where location_id = v_location_id) then
    raise exception 'Selecione pelo menos uma empresa aprovada';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_data->'schedule','[]'::jsonb))
  loop
    insert into public.exam_location_schedule_rules(
      location_id, weekday, start_time, end_time, slot_minutes, is_active
    )
    values (
      v_location_id, (v_item->>'weekday')::smallint, (v_item->>'start_time')::time,
      (v_item->>'end_time')::time, greatest(5, least(240, (v_item->>'slot_minutes')::integer)), true
    );
  end loop;

  if not exists (
    select 1 from public.exam_location_schedule_rules
    where location_id = v_location_id and is_active
  ) then
    raise exception 'Configure pelo menos um dia de atendimento';
  end if;

  return v_location_id;
end;
$$;

create or replace function public.deactivate_exam_location(p_location_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'master'::public.app_role) then
    raise exception 'Acesso não autorizado';
  end if;

  update public.exam_locations
     set is_active = false, updated_at = now()
   where id = p_location_id;

  return found;
end;
$$;

revoke execute on function public.save_exam_location(uuid, jsonb) from public, anon;
grant execute on function public.save_exam_location(uuid, jsonb) to authenticated;
revoke execute on function public.deactivate_exam_location(uuid) from public, anon;
grant execute on function public.deactivate_exam_location(uuid) to authenticated;


-- Server-side clinic save used by the authenticated application server.
-- EXECUTE is intentionally limited to service_role; the function validates p_user_id itself.
revoke execute on function public.save_exam_location_for_user(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_exam_location_for_user(uuid, jsonb, uuid) to service_role;
notify pgrst, 'reload schema';
