CREATE TABLE public.exam_location_companies (
  location_id uuid NOT NULL REFERENCES public.exam_locations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_location_companies TO authenticated;
GRANT ALL ON public.exam_location_companies TO service_role;
ALTER TABLE public.exam_location_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_location_companies_read ON public.exam_location_companies FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE POLICY exam_location_companies_write ON public.exam_location_companies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

CREATE TABLE public.exam_location_schedule_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.exam_locations(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_location_schedule_rules_valid_time CHECK (end_time > start_time),
  UNIQUE(location_id, weekday, start_time, end_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_location_schedule_rules TO authenticated;
GRANT ALL ON public.exam_location_schedule_rules TO service_role;
ALTER TABLE public.exam_location_schedule_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_location_schedule_rules_read ON public.exam_location_schedule_rules FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'master') OR EXISTS (
    SELECT 1 FROM public.exam_location_companies lc
    WHERE lc.location_id = exam_location_schedule_rules.location_id AND lc.company_id = public.current_company_id()
  )
);
CREATE POLICY exam_location_schedule_rules_write ON public.exam_location_schedule_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

DROP POLICY IF EXISTS exam_locations_read ON public.exam_locations;
CREATE POLICY exam_locations_read ON public.exam_locations FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'master')
  OR NOT EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id = exam_locations.id)
  OR EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id = exam_locations.id AND lc.company_id = public.current_company_id())
);

DROP POLICY IF EXISTS availability_slots_read ON public.availability_slots;
CREATE POLICY availability_slots_read ON public.availability_slots FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'master')
  OR NOT EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id = availability_slots.location_id)
  OR EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id = availability_slots.location_id AND lc.company_id = public.current_company_id())
);

CREATE OR REPLACE FUNCTION public.create_clinic_with_schedule(_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _location_id uuid; _company_id uuid; _rule jsonb; _company_ids uuid[];
  _weekday integer; _start time; _end time; _slot_minutes integer; _day date; _slot_start timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Master access required'; END IF;
  IF trim(coalesce(_data->>'name',''))='' OR trim(coalesce(_data->>'street',''))='' OR trim(coalesce(_data->>'city',''))='' OR trim(coalesce(_data->>'state',''))='' THEN RAISE EXCEPTION 'Clinic name, street, city and state are required'; END IF;
  SELECT array_agg(value::uuid) INTO _company_ids FROM jsonb_array_elements_text(coalesce(_data->'company_ids','[]'::jsonb));
  IF coalesce(array_length(_company_ids,1),0)=0 THEN RAISE EXCEPTION 'Select at least one approved company'; END IF;
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.id=ANY(_company_ids) AND c.status<>'approved')
     OR EXISTS (SELECT 1 FROM unnest(_company_ids) x(id) WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id=x.id)) THEN
    RAISE EXCEPTION 'All selected companies must be approved';
  END IF;
  INSERT INTO public.exam_locations(name,street,number,complement,district,city,state,postal_code,phone,is_active,created_by)
  VALUES (trim(_data->>'name'),trim(_data->>'street'),nullif(trim(_data->>'number'),''),nullif(trim(_data->>'complement'),''),nullif(trim(_data->>'district'),''),trim(_data->>'city'),upper(trim(_data->>'state')),nullif(trim(_data->>'postal_code'),''),nullif(trim(_data->>'phone'),''),true,auth.uid())
  RETURNING id INTO _location_id;
  FOREACH _company_id IN ARRAY _company_ids LOOP
    INSERT INTO public.exam_location_companies(location_id,company_id) VALUES (_location_id,_company_id);
  END LOOP;
  FOR _rule IN SELECT value FROM jsonb_array_elements(coalesce(_data->'schedule','[]'::jsonb)) LOOP
    _weekday:=(_rule->>'weekday')::integer; _start:=(_rule->>'start_time')::time; _end:=(_rule->>'end_time')::time; _slot_minutes:=coalesce((_rule->>'slot_minutes')::integer,30);
    IF _weekday NOT BETWEEN 0 AND 6 OR _end<=_start OR _slot_minutes NOT BETWEEN 5 AND 240 THEN RAISE EXCEPTION 'Invalid clinic schedule'; END IF;
    INSERT INTO public.exam_location_schedule_rules(location_id,weekday,start_time,end_time,slot_minutes,is_active) VALUES (_location_id,_weekday,_start,_end,_slot_minutes,true);
    FOR _day IN SELECT (current_date+gs)::date FROM generate_series(0,179) gs WHERE extract(dow FROM (current_date+gs)::date)=_weekday LOOP
      _slot_start:=((_day+_start) AT TIME ZONE 'America/Sao_Paulo');
      WHILE _slot_start+make_interval(mins=>_slot_minutes)<=((_day+_end) AT TIME ZONE 'America/Sao_Paulo') LOOP
        INSERT INTO public.availability_slots(location_id,starts_at,ends_at,is_active,created_by)
        VALUES (_location_id,_slot_start,_slot_start+make_interval(mins=>_slot_minutes),true,auth.uid())
        ON CONFLICT (location_id,starts_at,ends_at) DO NOTHING;
        _slot_start:=_slot_start+make_interval(mins=>_slot_minutes);
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN _location_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_clinic_with_schedule(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_controlled_appointment(
  _employee_id uuid,_assessment_type text,_job_title text,_slot_id uuid,_exam_ids uuid[],_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _appointment_id uuid; _company_id uuid; _caller_company_id uuid; _is_master boolean;
  _slot public.availability_slots%ROWTYPE; _location public.exam_locations%ROWTYPE; _exam_id uuid; _master_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT public.has_role(auth.uid(),'master') INTO _is_master;
  SELECT company_id INTO _caller_company_id FROM public.profiles WHERE id=auth.uid() AND is_active;
  SELECT company_id INTO _company_id FROM public.employees WHERE id=_employee_id AND is_active;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Employee unavailable'; END IF;
  IF NOT _is_master AND (_caller_company_id IS NULL OR _caller_company_id<>_company_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF trim(coalesce(_job_title,''))='' THEN RAISE EXCEPTION 'Job title required'; END IF;
  IF coalesce(array_length(_exam_ids,1),0)=0 THEN RAISE EXCEPTION 'Select at least one exam'; END IF;
  SELECT * INTO _slot FROM public.availability_slots WHERE id=_slot_id FOR UPDATE;
  IF _slot.id IS NULL OR NOT _slot.is_active OR _slot.starts_at<=now() THEN RAISE EXCEPTION 'Slot unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE slot_id=_slot_id AND status<>'cancelled') THEN RAISE EXCEPTION 'Slot already booked'; END IF;
  SELECT * INTO _location FROM public.exam_locations WHERE id=_slot.location_id AND is_active;
  IF _location.id IS NULL THEN RAISE EXCEPTION 'Location unavailable'; END IF;
  IF NOT _is_master AND EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id=_location.id)
     AND NOT EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id=_location.id AND lc.company_id=_company_id) THEN
    RAISE EXCEPTION 'Clinic not enabled for company';
  END IF;
  FOREACH _exam_id IN ARRAY _exam_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.exams WHERE id=_exam_id AND is_active) THEN RAISE EXCEPTION 'Invalid exam'; END IF;
    IF NOT _is_master AND NOT EXISTS (SELECT 1 FROM public.employee_exams WHERE employee_id=_employee_id AND exam_id=_exam_id) THEN RAISE EXCEPTION 'Exam not allowed for employee'; END IF;
  END LOOP;
  INSERT INTO public.appointments(company_id,employee_id,assessment_type,job_title,starts_at,ends_at,location,location_id,slot_id,notes,created_by,updated_by)
  VALUES(_company_id,_employee_id,trim(_assessment_type),trim(_job_title),_slot.starts_at,_slot.ends_at,_location.name,_location.id,_slot.id,nullif(trim(coalesce(_notes,'')),''),auth.uid(),auth.uid())
  RETURNING id INTO _appointment_id;
  INSERT INTO public.appointment_exams(appointment_id,exam_id) SELECT _appointment_id,unnest(_exam_ids);
  INSERT INTO public.appointment_history(appointment_id,action,new_status,actor_id) VALUES(_appointment_id,'created','scheduled',auth.uid());
  IF NOT _is_master THEN
    FOR _master_id IN SELECT user_id FROM public.user_roles WHERE role='master' LOOP
      INSERT INTO public.notifications(recipient_id,type,appointment_id) VALUES(_master_id,'appointment_created',_appointment_id);
    END LOOP;
  END IF;
  RETURN _appointment_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_controlled_appointment(uuid,text,text,uuid,uuid[],text) TO authenticated;

CREATE TRIGGER exam_location_schedule_rules_updated BEFORE UPDATE ON public.exam_location_schedule_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
