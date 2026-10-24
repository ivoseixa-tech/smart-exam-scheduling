CREATE OR REPLACE FUNCTION public.finalize_appointment_employee_details(p_appointment_id uuid, p_exam_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  appointment public.appointments%ROWTYPE;
  employee public.employees%ROWTYPE;
  details public.employees%ROWTYPE;
BEGIN
  SELECT * INTO STRICT appointment FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  SELECT * INTO STRICT employee FROM public.employees WHERE id = appointment.employee_id FOR UPDATE;
  IF employee.company_id <> appointment.company_id THEN
    RAISE EXCEPTION 'Employee company does not match appointment';
  END IF;
  IF coalesce(array_length(p_exam_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one exam is required';
  END IF;
  INSERT INTO public.appointment_exams (appointment_id, exam_id)
    SELECT p_appointment_id, unnest(p_exam_ids);
  IF appointment.employee_snapshot IS NOT NULL THEN
    SELECT * INTO details FROM jsonb_populate_record(NULL::public.employees, appointment.employee_snapshot);
    IF details.cpf IS DISTINCT FROM employee.cpf THEN
      RAISE EXCEPTION 'Employee CPF does not match appointment';
    END IF;
    IF details.occupational_function_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.occupational_functions WHERE id = details.occupational_function_id
        AND company_id = employee.company_id AND is_active
    ) THEN
      RAISE EXCEPTION 'Invalid occupational function';
    END IF;
    UPDATE public.employees SET
      full_name = details.full_name, cpf = details.cpf, rg = details.rg,
      birthplace = details.birthplace, nationality = details.nationality,
      birth_date = details.birth_date, sex = details.sex,
      job_title = coalesce(appointment.job_title, details.job_title),
      occupational_function_id = details.occupational_function_id,
      admission_date = details.admission_date, workplace = details.workplace,
      updated_at = clock_timestamp()
    WHERE id = employee.id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_appointment_employee_details(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_appointment_employee_details(uuid, uuid[]) TO service_role;
COMMENT ON FUNCTION public.finalize_appointment_employee_details(uuid, uuid[]) IS 'Service-only appointment finalization: atomically saves exams and latest employee details, preserving all appointment snapshots. Call only after authenticated tenant and exam validation.';
COMMENT ON COLUMN public.appointments.employee_snapshot IS 'Immutable employee details used for this appointment. Successful new appointment saves also update the current employee registry; prior appointment snapshots remain unchanged.';