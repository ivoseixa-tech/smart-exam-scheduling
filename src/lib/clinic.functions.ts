import { createServerFn } from "@tanstack/react-start";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

function getClinicSql() {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Conexão PostgreSQL do Neon não configurada no ambiente do servidor.");
  }

  try {
    new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL/NEON_DATABASE_URL precisa ser a URL completa de conexão do PostgreSQL do Neon.");
  }

  return neon(databaseUrl);
}

export const listClinics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master",
    });

    if (roleError || !isMaster) {
      throw new Error("Acesso permitido somente ao usuário mestre.");
    }

    const sql = getClinicSql();
    const rows = await sql`SELECT public.list_clinics() AS data`;
    return rows[0]?.data ?? [];
  });

export const createClinicWithSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clinicInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master",
    });

    if (roleError || !isMaster) {
      throw new Error("Acesso permitido somente ao usuário mestre.");
    }

    const sql = getClinicSql();
    const rows = await sql`
      SELECT public.create_clinic_with_schedule(
        ${JSON.stringify(data)}::jsonb,
        ${context.userId}::uuid
      ) AS data
    `;

    const result = rows[0]?.data;
    if (!result || result.ok !== true) {
      throw new Error("Não foi possível concluir o cadastro da clínica.");
    }

    return result;
  });
