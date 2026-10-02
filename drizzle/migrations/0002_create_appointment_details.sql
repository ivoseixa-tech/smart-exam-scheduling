CREATE TABLE public.appointment_exams (
 appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
 exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE RESTRICT,
 PRIMARY KEY(appointment_id, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_exams TO authenticated;
GRANT ALL ON public.appointment_exams TO service_role;
ALTER TABLE public.appointment_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointment_exams_all ON public.appointment_exams FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND (public.has_role(auth.uid(),'master') OR a.company_id = public.current_company_id())))
WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND (public.has_role(auth.uid(),'master') OR a.company_id = public.current_company_id())));

CREATE TABLE public.appointment_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
 action text NOT NULL CHECK (action = ANY (ARRAY['created','updated','approved','rejected','confirmed','rescheduled','completed','cancelled'])),
 previous_status public.appointment_status,
 new_status public.appointment_status,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.appointment_history TO authenticated;
GRANT ALL ON public.appointment_history TO service_role;
ALTER TABLE public.appointment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_read ON public.appointment_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND (public.has_role(auth.uid(),'master') OR a.company_id = public.current_company_id())));
CREATE POLICY history_insert ON public.appointment_history FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND (public.has_role(auth.uid(),'master') OR a.company_id = public.current_company_id())));
CREATE INDEX history_appointment_idx ON public.appointment_history(appointment_id, created_at DESC);