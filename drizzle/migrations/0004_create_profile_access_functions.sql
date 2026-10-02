CREATE OR REPLACE FUNCTION public.initialize_profile(_full_name text, _language text DEFAULT 'pt') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_master boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF char_length(trim(_full_name)) < 2 OR char_length(trim(_full_name)) > 120 THEN RAISE EXCEPTION 'Invalid name'; END IF;
 IF _language NOT IN ('pt','en') THEN RAISE EXCEPTION 'Invalid language'; END IF;
 PERFORM pg_advisory_xact_lock(4815162342);
 SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master') INTO _is_master;
 INSERT INTO public.profiles(id, full_name, preferred_language) VALUES (auth.uid(), trim(_full_name), _language)
 ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, preferred_language = excluded.preferred_language, updated_at = now();
 INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), CASE WHEN _is_master THEN 'master'::public.app_role ELSE 'company_user'::public.app_role END) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('is_master', _is_master);
END;
$$;
GRANT EXECUTE ON FUNCTION public.initialize_profile(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_company_access_code(_company_id uuid, _plain_code text, _label text DEFAULT 'Acesso principal', _expires_at timestamptz DEFAULT NULL, _max_uses integer DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF char_length(_plain_code) < 8 OR char_length(_plain_code) > 64 THEN RAISE EXCEPTION 'Invalid code'; END IF;
 INSERT INTO public.company_access_codes(company_id, code_hash, label, expires_at, max_uses, created_by)
 VALUES (_company_id, crypt(_plain_code, gen_salt('bf')), trim(_label), _expires_at, _max_uses, auth.uid()) RETURNING id INTO _id;
 RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_company_access_code(uuid, text, text, timestamptz, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_company_with_code(_plain_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code_id uuid; _company_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT c.id, c.company_id INTO _code_id, _company_id FROM public.company_access_codes c JOIN public.companies co ON co.id = c.company_id
 WHERE c.is_active AND co.status = 'approved' AND (c.expires_at IS NULL OR c.expires_at > now())
 AND (c.max_uses IS NULL OR c.use_count < c.max_uses) AND c.code_hash = crypt(_plain_code, c.code_hash)
 ORDER BY c.created_at DESC LIMIT 1 FOR UPDATE OF c;
 IF _code_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired code'; END IF;
 UPDATE public.profiles SET company_id = _company_id, updated_at = now() WHERE id = auth.uid();
 UPDATE public.company_access_codes SET use_count = use_count + 1 WHERE id = _code_id;
 RETURN _company_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_company_with_code(text) TO authenticated;