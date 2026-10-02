CREATE OR REPLACE FUNCTION public.initialize_profile(_full_name text, _language text DEFAULT 'pt') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_master boolean;
DECLARE _is_active boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF char_length(trim(_full_name)) < 2 OR char_length(trim(_full_name)) > 120 THEN RAISE EXCEPTION 'Invalid name'; END IF;
 IF _language NOT IN ('pt','en') THEN RAISE EXCEPTION 'Invalid language'; END IF;
 PERFORM pg_advisory_xact_lock(4815162342);
 SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master') INTO _is_master;
 _is_active := _is_master;
 INSERT INTO public.profiles(id, full_name, preferred_language, is_active)
 VALUES (auth.uid(), trim(_full_name), _language, _is_active)
 ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, preferred_language = excluded.preferred_language, updated_at = now();
 INSERT INTO public.user_roles(user_id, role)
 VALUES (auth.uid(), CASE WHEN _is_master THEN 'master'::public.app_role ELSE 'company_user'::public.app_role END)
 ON CONFLICT DO NOTHING;
 SELECT is_active INTO _is_active FROM public.profiles WHERE id = auth.uid();
 RETURN jsonb_build_object('is_master', _is_master, 'is_active', _is_active);
END;
$$;
GRANT EXECUTE ON FUNCTION public.initialize_profile(text, text) TO authenticated;