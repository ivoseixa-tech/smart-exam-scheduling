-- Repair clinic/company scheduling tables that may be missing in an existing database.
-- Idempotent: preserves any existing clinic/company links and schedule rules.

CREATE TABLE IF NOT EXISTS public.exam_location_companies (
  location_id uuid NOT NULL REFERENCES public.exam_locations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_location_companies TO authenticated;
GRANT ALL ON public.exam_location_companies TO service_role;
ALTER TABLE public.exam_location_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_location_companies_read ON public.exam_location_companies;
CREATE POLICY exam_location_companies_read
  ON public.exam_location_companies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR company_id = public.current_company_id());

DROP POLICY IF EXISTS exam_location_companies_write ON public.exam_location_companies;
CREATE POLICY exam_location_companies_write
  ON public.exam_location_companies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'))
  WITH CHECK (public.has_role(auth.uid(),'master'));

CREATE TABLE IF NOT EXISTS public.exam_location_schedule_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.exam_locations(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_location_schedule_rules_valid_time CHECK (end_time > start_time),
  UNIQUE(location_id, weekday, start_time, end_time)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_location_schedule_rules TO authenticated;
GRANT ALL ON public.exam_location_schedule_rules TO service_role;
ALTER TABLE public.exam_location_schedule_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_location_schedule_rules_read ON public.exam_location_schedule_rules;
CREATE POLICY exam_location_schedule_rules_read
  ON public.exam_location_schedule_rules
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'master')
    OR EXISTS (
      SELECT 1
      FROM public.exam_location_companies lc
      WHERE lc.location_id = exam_location_schedule_rules.location_id
        AND lc.company_id = public.current_company_id()
    )
  );

DROP POLICY IF EXISTS exam_location_schedule_rules_write ON public.exam_location_schedule_rules;
CREATE POLICY exam_location_schedule_rules_write
  ON public.exam_location_schedule_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'))
  WITH CHECK (public.has_role(auth.uid(),'master'));

DROP TRIGGER IF EXISTS exam_location_schedule_rules_updated ON public.exam_location_schedule_rules;
CREATE TRIGGER exam_location_schedule_rules_updated
  BEFORE UPDATE ON public.exam_location_schedule_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS exam_locations_read ON public.exam_locations;
CREATE POLICY exam_locations_read
  ON public.exam_locations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'master')
    OR NOT EXISTS (
      SELECT 1 FROM public.exam_location_companies lc
      WHERE lc.location_id = exam_locations.id
    )
    OR EXISTS (
      SELECT 1 FROM public.exam_location_companies lc
      WHERE lc.location_id = exam_locations.id
        AND lc.company_id = public.current_company_id()
    )
  );

DROP POLICY IF EXISTS availability_slots_read ON public.availability_slots;
CREATE POLICY availability_slots_read
  ON public.availability_slots
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'master')
    OR NOT EXISTS (
      SELECT 1 FROM public.exam_location_companies lc
      WHERE lc.location_id = availability_slots.location_id
    )
    OR EXISTS (
      SELECT 1 FROM public.exam_location_companies lc
      WHERE lc.location_id = availability_slots.location_id
        AND lc.company_id = public.current_company_id()
    )
  );

NOTIFY pgrst, 'reload schema';