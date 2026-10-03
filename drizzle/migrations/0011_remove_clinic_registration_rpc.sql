-- The clinic registration flow is now handled exclusively by the server.
-- Keep the 0010 migration intact for existing migration history, but remove
-- the obsolete PostgREST RPC so new environments do not depend on it.

DROP FUNCTION IF EXISTS public.create_clinic_with_schedule(jsonb);
