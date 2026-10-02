ALTER TABLE public.employees
  ALTER COLUMN rg DROP NOT NULL,
  ALTER COLUMN admission_date DROP NOT NULL;

COMMENT ON COLUMN public.employees.rg IS 'Optional employee identity document.';
COMMENT ON COLUMN public.employees.admission_date IS 'Optional employee admission date.';

ALTER TABLE public.appointments
  ADD COLUMN job_title text;

UPDATE public.appointments AS a
SET job_title = e.job_title
FROM public.employees AS e
WHERE a.employee_id = e.id
  AND a.job_title IS NULL;

COMMENT ON COLUMN public.appointments.job_title IS 'Employee job title recorded at scheduling time.';