CREATE TABLE public.appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
 assessment_type text NOT NULL CHECK (assessment_type = ANY (ARRAY['admission','periodic','return_to_work','risk_change','dismissal'])),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 location text NOT NULL,
 notes text,
 status public.appointment_status NOT NULL DEFAULT 'scheduled',
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at > starts_at),
 CHECK (notes IS NULL OR char_length(notes) <= 2000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointments_read ON public.appointments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE POLICY appointments_insert ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'master') OR (company_id = public.current_company_id() AND created_by = auth.uid() AND updated_by = auth.uid()));
CREATE POLICY appointments_update ON public.appointments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id()) WITH CHECK (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE POLICY appointments_delete ON public.appointments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());
CREATE INDEX appointments_company_start_idx ON public.appointments(company_id, starts_at);