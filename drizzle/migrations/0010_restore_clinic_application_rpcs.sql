CREATE FUNCTION public.save_clinic_for_user(p_data jsonb, p_user_id uuid, p_location_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT public.save_exam_location_for_user(p_location_id,p_data,p_user_id); $$;
REVOKE EXECUTE ON FUNCTION public.save_clinic_for_user(jsonb,uuid,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_clinic_for_user(jsonb,uuid,uuid) TO service_role;
CREATE FUNCTION public.deactivate_exam_location(p_location_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; UPDATE public.exam_locations SET is_active=false,updated_at=now() WHERE id=p_location_id; RETURN FOUND; END; $$;
REVOKE EXECUTE ON FUNCTION public.deactivate_exam_location(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.deactivate_exam_location(uuid) TO authenticated;