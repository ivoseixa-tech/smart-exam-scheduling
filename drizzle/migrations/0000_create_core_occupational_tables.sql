CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE public.app_role AS ENUM ('master', 'company_user');
CREATE TYPE public.company_status AS ENUM ('pending', 'approved', 'rejected', 'inactive');
CREATE TYPE public.exam_category AS ENUM ('clinical', 'complementary');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled');

CREATE TABLE public.companies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cnpj text NOT NULL UNIQUE, legal_name text NOT NULL, trade_name text,
 registration_status text, cnae_code text, cnae_description text, email text, phone text, street text, number text,
 complement text, district text, city text, state text, postal_code text, status public.company_status NOT NULL DEFAULT 'pending',
 rejection_reason text, reviewed_by uuid, reviewed_at timestamptz, created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT companies_cnpj_format CHECK (cnpj ~ '^[0-9]{14}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
 full_name text NOT NULL, job_title text, phone text, preferred_language text NOT NULL DEFAULT 'pt',
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT profiles_language CHECK (preferred_language IN ('pt','en'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_active LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'master')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'master'));
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'master'));
CREATE POLICY companies_read ON public.companies FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master') OR id = public.current_company_id());
CREATE POLICY companies_insert ON public.companies FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master') AND created_by = auth.uid());
CREATE POLICY companies_update ON public.companies FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));
CREATE POLICY companies_delete ON public.companies FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'));

CREATE TABLE public.company_access_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 code_hash text NOT NULL, label text NOT NULL DEFAULT 'Acesso principal', expires_at timestamptz, max_uses integer,
 use_count integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true, created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT codes_max_uses CHECK (max_uses IS NULL OR max_uses > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_access_codes TO authenticated;
GRANT ALL ON public.company_access_codes TO service_role;
ALTER TABLE public.company_access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY codes_master ON public.company_access_codes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

CREATE TABLE public.employees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 full_name text NOT NULL, cpf text NOT NULL, rg text NOT NULL, birthplace text NOT NULL, nationality text NOT NULL,
 birth_date date NOT NULL, sex text NOT NULL, job_title text NOT NULL, admission_date date NOT NULL, workplace text NOT NULL,
 is_active boolean NOT NULL DEFAULT true, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id, cpf),
 CONSTRAINT employees_cpf_format CHECK (cpf ~ '^[0-9]{11}$'),
 CONSTRAINT employees_sex CHECK (sex IN ('female','male','other','not_informed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY employees_read ON public.employees FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE POLICY employees_insert ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master') OR (company_id = public.current_company_id() AND created_by = auth.uid()));
CREATE POLICY employees_update ON public.employees FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id()) WITH CHECK (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE POLICY employees_delete ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());

CREATE TABLE public.exams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category public.exam_category NOT NULL, name_pt text NOT NULL, name_en text NOT NULL,
 description_pt text, description_en text, preparation_pt text, preparation_en text,
 duration_minutes integer NOT NULL DEFAULT 30, is_active boolean NOT NULL DEFAULT true, created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(category, name_pt),
 CONSTRAINT exams_duration CHECK (duration_minutes BETWEEN 5 AND 480)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY exams_read ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY exams_write ON public.exams FOR ALL TO authenticated USING (public.has_role(auth.uid(),'master')) WITH CHECK (public.has_role(auth.uid(),'master'));

CREATE INDEX employees_company_name_idx ON public.employees(company_id, full_name);
CREATE INDEX profiles_company_idx ON public.profiles(company_id);
CREATE INDEX codes_company_idx ON public.company_access_codes(company_id);