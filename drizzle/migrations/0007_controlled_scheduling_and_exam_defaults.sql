CREATE TABLE public.occupational_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.occupational_functions TO authenticated;
GRANT ALL ON public.occupational_functions TO service_role;
ALTER TABLE public.occupational_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY occupational_functions_read ON public.occupational_functions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE POLICY occupational_functions_write ON public.occupational_functions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id()) WITH CHECK (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());

CREATE TABLE public.occupational_function_exams (
  function_id uuid NOT NULL REFERENCES public.occupational_functions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  PRIMARY KEY(function_id, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.occupational_function_exams TO authenticated;
GRANT ALL ON public.occupational_function_exams TO service_role;
ALTER TABLE public.occupational_function_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY occupational_function_exams_all ON public.occupational_function_exams FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.occupational_functions f WHERE f.id=function_id AND (public.has_role(auth.uid(),'master') OR f.company_id=public.current_company_id()))) WITH CHECK (EXISTS (SELECT 1 FROM public.occupational_functions f WHERE f.id=function_id AND (public.has_role(auth.uid(),'master') OR f.company_id=public.current_company_id())));

CREATE TABLE public.employee_exams (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  PRIMARY KEY(employee_id, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_exams TO authenticated;
GRANT ALL ON public.employee_exams TO service_role;
ALTER TABLE public.employee_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_exams_all ON public.employee_exams FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND (public.has_role(auth.uid(),'master') OR e.company_id=public.current_company_id()))) WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id=employee_id AND (public.has_role(auth.uid(),'master') OR e.company_id=public.current_company_id())));

ALTER TABLE public.employees ADD COLUMN occupational_function_id uuid REFERENCES public.occupational_functions(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN location_id uuid;
ALTER TABLE public.appointments ADD COLUMN slot_id uuid;

CREATE TABLE public.exam_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  street text NOT NULL,
  number text,
  complement text,
  district text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text,
  phone text,
  instructions_pt text,
  instructions_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exam_locations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exam_locations TO authenticated;
GRANT ALL ON public.exam_locations TO service_role;
ALTER TABLE public.exam_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_locations_read ON public.exam_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_locations_write ON public.exam_locations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

CREATE TABLE public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.exam_locations(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_slots_valid_time CHECK (ends_at > starts_at),
  UNIQUE(location_id, starts_at, ends_at)
);
GRANT SELECT ON public.availability_slots TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.availability_slots TO authenticated;
GRANT ALL ON public.availability_slots TO service_role;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY availability_slots_read ON public.availability_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY availability_slots_write ON public.availability_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

ALTER TABLE public.appointments ADD CONSTRAINT appointments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.exam_locations(id);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.availability_slots(id);
CREATE UNIQUE INDEX appointments_active_slot_unique ON public.appointments(slot_id) WHERE slot_id IS NOT NULL AND status <> 'cancelled';

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  type text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated USING (recipient_id=auth.uid() AND public.has_role(auth.uid(),'master'));
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING (recipient_id=auth.uid() AND public.has_role(auth.uid(),'master')) WITH CHECK (recipient_id=auth.uid() AND public.has_role(auth.uid(),'master'));

CREATE OR REPLACE FUNCTION public.create_controlled_appointment(
  _employee_id uuid,
  _assessment_type text,
  _job_title text,
  _slot_id uuid,
  _exam_ids uuid[],
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _appointment_id uuid;
  _company_id uuid;
  _caller_company_id uuid;
  _is_master boolean;
  _slot public.availability_slots%ROWTYPE;
  _location public.exam_locations%ROWTYPE;
  _exam_id uuid;
  _master_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT public.has_role(auth.uid(),'master') INTO _is_master;
  SELECT company_id INTO _caller_company_id FROM public.profiles WHERE id=auth.uid() AND is_active;
  SELECT company_id INTO _company_id FROM public.employees WHERE id=_employee_id AND is_active;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Employee unavailable'; END IF;
  IF NOT _is_master AND (_caller_company_id IS NULL OR _caller_company_id <> _company_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF trim(coalesce(_job_title,''))='' THEN RAISE EXCEPTION 'Job title required'; END IF;
  IF coalesce(array_length(_exam_ids,1),0)=0 THEN RAISE EXCEPTION 'Select at least one exam'; END IF;

  SELECT * INTO _slot FROM public.availability_slots WHERE id=_slot_id FOR UPDATE;
  IF _slot.id IS NULL OR NOT _slot.is_active OR _slot.starts_at <= now() THEN RAISE EXCEPTION 'Slot unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE slot_id=_slot_id AND status <> 'cancelled') THEN RAISE EXCEPTION 'Slot already booked'; END IF;
  SELECT * INTO _location FROM public.exam_locations WHERE id=_slot.location_id AND is_active;
  IF _location.id IS NULL THEN RAISE EXCEPTION 'Location unavailable'; END IF;

  FOREACH _exam_id IN ARRAY _exam_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.exams WHERE id=_exam_id AND is_active) THEN RAISE EXCEPTION 'Invalid exam'; END IF;
    IF NOT _is_master AND NOT EXISTS (SELECT 1 FROM public.employee_exams WHERE employee_id=_employee_id AND exam_id=_exam_id) THEN RAISE EXCEPTION 'Exam not allowed for employee'; END IF;
  END LOOP;

  INSERT INTO public.appointments(company_id,employee_id,assessment_type,job_title,starts_at,ends_at,location,location_id,slot_id,notes,created_by,updated_by)
  VALUES(_company_id,_employee_id,trim(_assessment_type),trim(_job_title),_slot.starts_at,_slot.ends_at,_location.name,_location.id,_slot.id,nullif(trim(coalesce(_notes,'')),''),auth.uid(),auth.uid())
  RETURNING id INTO _appointment_id;

  INSERT INTO public.appointment_exams(appointment_id,exam_id)
  SELECT _appointment_id, unnest(_exam_ids);
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

CREATE TRIGGER occupational_functions_updated BEFORE UPDATE ON public.occupational_functions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exam_locations_updated BEFORE UPDATE ON public.exam_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();