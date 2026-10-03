import { createServerFn } from "@tanstack/react-start";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada para o banco PostgreSQL externo.");

const sql = neon(databaseUrl);

const clinicInput = z.object({
  name: z.string().trim().min(2).max(160),
  street: z.string().trim().min(2).max(200),
  number: z.string().trim().max(30),
  complement: z.string().trim().max(120),
  district: z.string().trim().max(120),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2),
  postal_code: z.string().trim().max(20),
  phone: z.string().trim().max(40),
  company_ids: z.array(z.string().uuid()).min(1),
  schedule: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    slot_minutes: z.number().int().min(5).max(240),
  })).min(1),
});

export const listClinics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master",
    });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");

    const clinics = await sql`
      SELECT
        c.id,
        c.name,
        c.street,
        c.number,
        c.complement,
        c.district,
        c.city,
        c.state,
        c.postal_code,
        c.phone,
        c.is_active,
        c.created_at,
        COALESCE((
          SELECT json_agg(json_build_object('location_id', cc.clinic_id, 'company_id', cc.company_id) ORDER BY cc.company_id)
          FROM public.clinic_companies cc
          WHERE cc.clinic_id = c.id
        ), '[]'::json) AS companies,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', sr.id,
            'location_id', sr.clinic_id,
            'weekday', sr.weekday,
            'start_time', sr.start_time,
            'end_time', sr.end_time,
            'slot_minutes', sr.slot_minutes,
            'is_active', sr.is_active
          ) ORDER BY sr.weekday, sr.start_time)
          FROM public.clinic_schedule_rules sr
          WHERE sr.clinic_id = c.id AND sr.is_active = true
        ), '[]'::json) AS schedule_rules
      FROM public.clinics c
      ORDER BY c.name
    `;

    return clinics;
  });

export const createClinicWithSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clinicInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master",
    });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");

    const duplicate = await sql`
      SELECT id FROM public.clinics
      WHERE lower(name) = lower(${data.name})
        AND lower(city) = lower(${data.city})
        AND state = ${data.state.toUpperCase()}
      LIMIT 1
    `;
    if (duplicate.length) throw new Error("Já existe uma clínica com este nome nesta cidade.");

    for (const rule of data.schedule) {
      if (rule.start_time >= rule.end_time) {
        throw new Error("O horário inicial deve ser menor que o horário final.");
      }
    }

    const clinicRows = await sql`
      INSERT INTO public.clinics
        (name, street, number, complement, district, city, state, postal_code, phone, created_by)
      VALUES
        (${data.name}, ${data.street}, ${data.number || null}, ${data.complement || null},
         ${data.district || null}, ${data.city}, ${data.state.toUpperCase()},
         ${data.postal_code || null}, ${data.phone || null}, ${context.userId})
      RETURNING id
    `;
    const clinicId = String(clinicRows[0].id);

    try {
      for (const companyId of data.company_ids) {
        await sql`
          INSERT INTO public.clinic_companies (clinic_id, company_id)
          VALUES (${clinicId}::uuid, ${companyId}::uuid)
          ON CONFLICT DO NOTHING
        `;
      }

      for (const rule of data.schedule) {
        await sql`
          INSERT INTO public.clinic_schedule_rules
            (clinic_id, weekday, start_time, end_time, slot_minutes)
          VALUES
            (${clinicId}::uuid, ${rule.weekday}, ${rule.start_time}::time,
             ${rule.end_time}::time, ${rule.slot_minutes})
        `;
      }
    } catch (error) {
      await sql`DELETE FROM public.clinics WHERE id = ${clinicId}::uuid`;
      throw error;
    }

    return { ok: true, clinicId, slotCount: 0 };
  });
