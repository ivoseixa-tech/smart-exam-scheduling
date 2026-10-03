-- Production-safe repair for clinic registration.
-- This migration is idempotent and restores the database RPC used by the clinic flow.
-- It can be applied independently of the application deployment.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agenda_login_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_agenda_login_code_uidx
  ON public.profiles (agenda_login_code)
  WHERE agenda_login_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_clinic_with_schedule(_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _location_id uuid;
  _company_id uuid;
  _rule jsonb;
  _company_ids uuid[];
  _weekday integer;
  _start time;
  _end time;
  _slot_minutes integer;
  _day date;
  _slot_start timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Master access required';
  END IF;

  IF trim(coalesce(_data->>'name', '')) = ''
     OR trim(coalesce(_data->>'street', '')) = ''
     OR trim(coalesce(_data->>'city', '')) = ''
     OR trim(coalesce(_data->>'state', '')) = '' THEN
    RAISE EXCEPTION 'Clinic name, street, city and state are required';
  END IF;

  SELECT array_agg(value::uuid)
    INTO _company_ids
  FROM jsonb_array_elements_text(coalesce(_data->'company_ids', '[]'::jsonb));

  IF coalesce(array_length(_company_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one approved company';
  END IF;

  IF EXISTS (
       SELECT 1
       FROM public.companies c
       WHERE c.id = ANY(_company_ids)
         AND c.status <> 'approved'
     )
     OR EXISTS (
       SELECT 1
       FROM unnest(_company_ids) x(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.companies c WHERE c.id = x.id
       )
     ) THEN
    RAISE EXCEPTION 'All selected companies must be approved';
  END IF;

  INSERT INTO public.exam_locations(
    name, street, number, complement, district, city, state,
    postal_code, phone, is_active, created_by
  )
  VALUES (
    trim(_data->>'name'),
    trim(_data->>'street'),
    nullif(trim(_data->>'number'), ''),
    nullif(trim(_data->>'complement'), ''),
    nullif(trim(_data->>'district'), ''),
    trim(_data->>'city'),
    upper(trim(_data->>'state')),
    nullif(trim(_data->>'postal_code'), ''),
    nullif(trim(_data->>'phone'), ''),
    true,
    auth.uid()
  )
  RETURNING id INTO _location_id;

  FOREACH _company_id IN ARRAY _company_ids LOOP
    INSERT INTO public.exam_location_companies(location_id, company_id)
    VALUES (_location_id, _company_id);
  END LOOP;

  FOR _rule IN
    SELECT value
    FROM jsonb_array_elements(coalesce(_data->'schedule', '[]'::jsonb))
  LOOP
    _weekday := (_rule->>'weekday')::integer;
    _start := (_rule->>'start_time')::time;
    _end := (_rule->>'end_time')::time;
    _slot_minutes := coalesce((_rule->>'slot_minutes')::integer, 30);

    IF _weekday NOT BETWEEN 0 AND 6
       OR _end <= _start
       OR _slot_minutes NOT BETWEEN 5 AND 240 THEN
      RAISE EXCEPTION 'Invalid clinic schedule';
    END IF;

    INSERT INTO public.exam_location_schedule_rules(
      location_id, weekday, start_time, end_time, slot_minutes, is_active
    )
    VALUES (
      _location_id, _weekday, _start, _end, _slot_minutes, true
    );

    FOR _day IN
      SELECT (current_date + gs)::date
      FROM generate_series(0, 179) gs
      WHERE extract(dow FROM (current_date + gs)::date) = _weekday
    LOOP
      _slot_start := ((_day + _start) AT TIME ZONE 'America/Sao_Paulo');

      WHILE _slot_start + make_interval(mins => _slot_minutes)
            <= ((_day + _end) AT TIME ZONE 'America/Sao_Paulo')
      LOOP
        INSERT INTO public.availability_slots(
          location_id, starts_at, ends_at, is_active, created_by
        )
        VALUES (
          _location_id,
          _slot_start,
          _slot_start + make_interval(mins => _slot_minutes),
          true,
          auth.uid()
        )
        ON CONFLICT (location_id, starts_at, ends_at) DO NOTHING;

        _slot_start := _slot_start + make_interval(mins => _slot_minutes);
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN _location_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_clinic_with_schedule(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_clinic_with_schedule(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_clinic_with_schedule(jsonb) TO authenticated;

-- Force PostgREST to see the function immediately after migration.
NOTIFY pgrst, 'reload schema';
