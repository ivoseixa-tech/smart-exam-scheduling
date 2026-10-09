-- Repair the clinic server RPC in the deployed database.
-- Keep the function callable only by service_role; authorization is validated by p_user_id.
create or replace function public.save_exam_location_for_user(p_location_id uuid, p_data jsonb, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_location_id uuid;
  v_company_id uuid;
  v_item jsonb;
  v_weekday smallint;
  v_start time;
  v_end time;
  v_slot integer;
begin
  if p_user_id is null or not public.has_role(p_user_id,'master'::public.app_role) then
    raise exception 'Acesso não autorizado para cadastrar clínicas';
  end if;
  if nullif(trim(coalesce(p_data->>'name','')),'') is null
     or nullif(trim(coalesce(p_data->>'street','')),'') is null
     or nullif(trim(coalesce(p_data->>'city','')),'') is null
     or length(trim(coalesce(p_data->>'state',''))) <> 2 then
    raise exception 'Preencha nome, endereço, cidade e UF da clínica';
  end if;
  if p_location_id is null then
    insert into public.exam_locations(name,street,number,complement,district,city,state,postal_code,phone,created_by,is_active)
    values(trim(p_data->>'name'),trim(p_data->>'street'),nullif(trim(coalesce(p_data->>'number','')),''),
      nullif(trim(coalesce(p_data->>'complement','')),''),nullif(trim(coalesce(p_data->>'district','')),''),
      trim(p_data->>'city'),upper(trim(p_data->>'state')),nullif(trim(coalesce(p_data->>'postal_code','')),''),
      nullif(trim(coalesce(p_data->>'phone','')),''),p_user_id,true)
    returning id into v_location_id;
  else
    update public.exam_locations set name=trim(p_data->>'name'),street=trim(p_data->>'street'),
      number=nullif(trim(coalesce(p_data->>'number','')),''),complement=nullif(trim(coalesce(p_data->>'complement','')),''),
      district=nullif(trim(coalesce(p_data->>'district','')),''),city=trim(p_data->>'city'),
      state=upper(trim(p_data->>'state')),postal_code=nullif(trim(coalesce(p_data->>'postal_code','')),''),
      phone=nullif(trim(coalesce(p_data->>'phone','')),''),is_active=true,updated_at=now()
    where id=p_location_id returning id into v_location_id;
    if v_location_id is null then raise exception 'Clínica não encontrada'; end if;
    delete from public.exam_location_companies where location_id=v_location_id;
    delete from public.exam_location_schedule_rules where location_id=v_location_id;
  end if;
  if jsonb_typeof(coalesce(p_data->'company_ids','[]'::jsonb)) <> 'array' then raise exception 'Lista de empresas inválida'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_data->'company_ids','[]'::jsonb)) loop
    begin v_company_id := (v_item #>> '{}')::uuid;
    exception when invalid_text_representation then raise exception 'Empresa inválida ou não aprovada'; end;
    if not exists(select 1 from public.companies where id=v_company_id and status='approved') then raise exception 'Empresa inválida ou não aprovada'; end if;
    insert into public.exam_location_companies(location_id,company_id)
    select v_location_id,v_company_id
    where not exists(select 1 from public.exam_location_companies where location_id=v_location_id and company_id=v_company_id);
  end loop;
  if not exists(select 1 from public.exam_location_companies where location_id=v_location_id) then raise exception 'Selecione pelo menos uma empresa aprovada'; end if;
  if jsonb_typeof(coalesce(p_data->'schedule','[]'::jsonb)) <> 'array' then raise exception 'Agenda semanal inválida'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_data->'schedule','[]'::jsonb)) loop
    begin
      v_weekday := (v_item->>'weekday')::smallint; v_start := (v_item->>'start_time')::time; v_end := (v_item->>'end_time')::time; v_slot := (v_item->>'slot_minutes')::integer;
    exception when others then raise exception 'Horário de atendimento inválido'; end;
    if v_weekday < 0 or v_weekday > 6 then raise exception 'Dia da semana inválido'; end if;
    if v_start >= v_end then raise exception 'O horário inicial deve ser menor que o horário final'; end if;
    if v_slot < 5 or v_slot > 240 then raise exception 'Duração do intervalo deve estar entre 5 e 240 minutos'; end if;
    insert into public.exam_location_schedule_rules(location_id,weekday,start_time,end_time,slot_minutes,is_active)
    values(v_location_id,v_weekday,v_start,v_end,v_slot,true);
  end loop;
  if not exists(select 1 from public.exam_location_schedule_rules where location_id=v_location_id and is_active) then raise exception 'Configure pelo menos um dia de atendimento'; end if;
  return v_location_id;
exception
  when foreign_key_violation then raise exception 'Não foi possível salvar a clínica: relacionamento de dados inválido';
  when unique_violation then raise exception 'Não foi possível salvar a clínica: registro duplicado';
end;
$function$;

revoke execute on function public.save_exam_location_for_user(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_exam_location_for_user(uuid,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
