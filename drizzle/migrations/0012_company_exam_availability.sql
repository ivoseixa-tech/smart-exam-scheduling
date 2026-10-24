ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS available_to_companies boolean NOT NULL DEFAULT true;

CREATE TABLE public.company_exam_settings (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_exam_settings TO authenticated;
GRANT ALL ON public.company_exam_settings TO service_role;
ALTER TABLE public.company_exam_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_exam_settings_access ON public.company_exam_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id())
  WITH CHECK (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());