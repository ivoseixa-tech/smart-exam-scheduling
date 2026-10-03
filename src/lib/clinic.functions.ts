import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLINIC_API_URL = "https://br-royal-forest-b469fwmo-clinicapi.compute.c-6.us-east-2.aws.neon.tech";

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

async function callClinicApi(path: string, init?: RequestInit) {
  const request = getRequest();
  const authorization = request?.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Sessão de usuário não encontrada.");
  }

  const response = await fetch(`${CLINIC_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: authorization,
      "Content-Type": "application/json",
    },
  });

  const body = await response.json().catch(() => ({ error: "Resposta inválida do serviço de clínicas." }));

  if (!response.ok) {
    throw new Error(body?.error || `Erro no serviço de clínicas (HTTP ${response.status}).`);
  }

  return body;
}

export const listClinics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return callClinicApi("/clinics");
  });

export const createClinicWithSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clinicInput.parse(input))
  .handler(async ({ data }) => {
    return callClinicApi("/clinics", {
      method: "POST",
      body: JSON.stringify(data),
    });
  });
