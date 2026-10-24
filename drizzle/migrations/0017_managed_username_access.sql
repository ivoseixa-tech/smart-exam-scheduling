ALTER TABLE public.profiles ADD COLUMN username text;
ALTER TABLE public.profiles ADD COLUMN initial_password_pending boolean NOT NULL DEFAULT false;
UPDATE public.profiles p SET username = lower(coalesce(nullif(u.raw_user_meta_data->>'login_code',''), 'user-' || replace(p.id::text,'-',''))) FROM auth.users u WHERE u.id=p.id;
CREATE UNIQUE INDEX profiles_username_unique ON public.profiles (lower(username)) WHERE username IS NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9._-]{2,63}$');
CREATE OR REPLACE FUNCTION public.protect_profile_access_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user NOT IN ('postgres','supabase_admin','service_role') AND coalesce(auth.role(),'') <> 'service_role' THEN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.username IS DISTINCT FROM OLD.username OR NEW.initial_password_pending IS DISTINCT FROM OLD.initial_password_pending THEN
   RAISE EXCEPTION 'Access fields may only be changed by user administration';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_protect_access_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_access_fields();
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.user_id=_user_id AND r.role=_role AND p.is_active);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.initialize_profile(_full_name text, _language text DEFAULT 'pt') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.profiles;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=auth.uid();
 IF p.id IS NULL THEN RAISE EXCEPTION 'Account must be created by the master'; END IF;
 RETURN to_jsonb(p);
END;
$$;