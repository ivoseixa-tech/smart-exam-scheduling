CREATE OR REPLACE FUNCTION public.initialize_profile(_full_name text, _language text DEFAULT 'pt'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _is_active boolean;
DECLARE _is_master boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF char_length(trim(_full_name)) < 2 OR char_length(trim(_full_name)) > 120 THEN RAISE EXCEPTION 'Invalid name'; END IF;
 IF _language NOT IN ('pt','en') THEN RAISE EXCEPTION 'Invalid language'; END IF;
 INSERT INTO public.profiles(id, full_name, preferred_language, is_active)
 VALUES (auth.uid(), trim(_full_name), _language, false)
 ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, preferred_language = excluded.preferred_language, updated_at = now();
 INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'company_user'::public.app_role) ON CONFLICT DO NOTHING;
 SELECT public.has_role(auth.uid(), 'master') INTO _is_master;
 SELECT is_active INTO _is_active FROM public.profiles WHERE id = auth.uid();
 RETURN jsonb_build_object('is_master', _is_master, 'is_active', _is_active);
END;
$function$;

DROP POLICY IF EXISTS exams_read ON public.exams;
CREATE POLICY exams_read ON public.exams FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'master') OR (is_active AND public.current_company_id() IS NOT NULL));

DROP POLICY IF EXISTS exam_locations_read ON public.exam_locations;
CREATE POLICY exam_locations_read ON public.exam_locations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'master') OR EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id = exam_locations.id AND lc.company_id = public.current_company_id()));

DROP POLICY IF EXISTS availability_slots_read ON public.availability_slots;
CREATE POLICY availability_slots_read ON public.availability_slots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'master') OR EXISTS (SELECT 1 FROM public.exam_location_companies lc WHERE lc.location_id = availability_slots.location_id AND lc.company_id = public.current_company_id()));

DROP POLICY IF EXISTS employee_exams_all ON public.employee_exams;
CREATE POLICY employee_exams_read ON public.employee_exams FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_exams.employee_id AND (public.has_role(auth.uid(),'master') OR e.company_id = public.current_company_id())));
CREATE POLICY employee_exams_master_write ON public.employee_exams FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

DROP POLICY IF EXISTS occupational_function_exams_all ON public.occupational_function_exams;
CREATE POLICY occupational_function_exams_read ON public.occupational_function_exams FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.occupational_functions f WHERE f.id = occupational_function_exams.function_id AND (public.has_role(auth.uid(),'master') OR f.company_id = public.current_company_id())));
CREATE POLICY occupational_function_exams_master_write ON public.occupational_function_exams FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));