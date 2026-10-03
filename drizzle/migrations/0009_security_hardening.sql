-- Security hardening: protect profile ownership and force controlled appointment creation.
-- Direct writes are removed from the authenticated role; SECURITY DEFINER RPCs remain the controlled write path.

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update_master ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'master'))
  WITH CHECK (public.has_role(auth.uid(),'master'));

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;

DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(),'master')
  );

-- Appointments are created only through create_controlled_appointment().
DROP POLICY IF EXISTS appointments_insert ON public.appointments;
DROP POLICY IF EXISTS appointments_update ON public.appointments;
DROP POLICY IF EXISTS appointments_delete ON public.appointments;
REVOKE INSERT, UPDATE, DELETE ON public.appointments FROM authenticated;

-- Appointment details and audit history are created only by the controlled RPC.
DROP POLICY IF EXISTS appointment_exams_all ON public.appointment_exams;
DROP POLICY IF EXISTS history_insert ON public.appointment_history;
REVOKE INSERT, UPDATE, DELETE ON public.appointment_exams FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appointment_history FROM authenticated;

-- Keep authenticated users able to read only data they are already authorized to see.
CREATE POLICY appointment_exams_read ON public.appointment_exams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id
        AND (public.has_role(auth.uid(),'master') OR a.company_id = public.current_company_id())
    )
  );

-- Harden SECURITY DEFINER execution privileges.
REVOKE ALL ON FUNCTION public.create_controlled_appointment(uuid,text,text,uuid,uuid[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_controlled_appointment(uuid,text,text,uuid,uuid[],text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_clinic_with_schedule(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_clinic_with_schedule(jsonb) TO authenticated;

-- SECURITY DEFINER functions use only trusted objects plus pg_temp as the final search path entry.
ALTER FUNCTION public.create_controlled_appointment(uuid,text,text,uuid,uuid[],text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_clinic_with_schedule(jsonb)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.initialize_profile(text,text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_company_access_code(uuid,text,text,timestamptz,integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.join_company_with_code(text)
  SET search_path = public, pg_temp;
