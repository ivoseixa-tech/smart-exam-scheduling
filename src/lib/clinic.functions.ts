import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLINIC_API_URL = "https://ep-frosty-haze-b4w572k4.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1";

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

async function callClinicApi(path: string, body: unknown) {
  const request = getRequest();
  const authorization = request?.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Sessão de usuário não encontrada.");
  }

  const response = await fetch(`${CLINIC_API_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error("Resposta inválida do serviço de clínicas.");
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
        ? data.error
        : `Erro no serviço de clínicas (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return data;
}

export const listClinics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return callClinicApi("/rpc/list_clinics", {});
  });

export const createClinicWithSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clinicInput.parse(input))
  .handler(async ({ data, context }) => {
    return callClinicApi("/rpc/create_clinic_with_schedule", {
      p_data: data,
      p_user_id: context.userId,
    });
  });
