import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

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

function getErrorMessage(error: unknown, fallback: string) {
  // Never expose database internals to the browser.
  const raw = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

  if (!raw.trim()) return fallback;

  const safe = raw
    .replace(/\s*—\s*\[SQLSTATE\s+[A-Z0-9]+\]/gi, "")
    .replace(/\b(?:SQLSTATE|DETAIL|HINT|CONTEXT|internal query|constraint)\s*:?[^\n]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return safe || fallback;
}

const CLINIC_API_URL = "https://br-royal-forest-b469fwmo-clinicapi.compute.c-6.us-east-2.aws.neon.tech/";

async function callClinicApi(action: "list" | "create" | "update" | "delete", data?: unknown, clinicId?: string) {
  const request = getRequest();
  const authorization = request?.headers?.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Não autenticado.");
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabasePublishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Configuração do Supabase não disponível no servidor da aplicação.");
  }

  const response = await fetch(CLINIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      "X-Supabase-URL": supabaseUrl,
      "X-Supabase-Publishable-Key": supabasePublishableKey,
    },
    body: JSON.stringify({ action, data, clinicId }),
  });

  const bodyText = await response.text();
  let body: { ok?: boolean; data?: unknown; error?: string };

  try {
    body = JSON.parse(bodyText) as typeof body;
  } catch {
    body = { error: bodyText || "Resposta inválida do serviço de clínicas." };
  }

  if (!response.ok || body.ok === false) {
    throw new Error(body.error || ("Serviço de clínicas respondeu com status " + response.status + "."));
  }

  return body.data;
}

export const listClinics = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const data = await callClinicApi("list");
      return Array.isArray(data) ? JSON.parse(JSON.stringify(data)) as unknown[] : [];
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao consultar as clínicas.");
      console.error("[Clinic:listClinics]", message);
      throw new Error("Não foi possível carregar as clínicas: " + message);
    }
  });

export const updateClinicWithSchedule = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    clinicId: z.string().uuid(),
    data: clinicInput,
  }).parse(input))
  .handler(async ({ data }) => {
    try {
      const result = await callClinicApi("update", data.data, data.clinicId) as { ok?: boolean; clinicId?: string; slotCount?: number } | null;
      if (!result?.ok || typeof result.clinicId !== "string") {
        throw new Error("Não foi possível atualizar a clínica.");
      }
      return { ok: true, clinicId: result.clinicId, slotCount: Number(result.slotCount ?? 0) };
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao atualizar a clínica.");
      console.error("[Clinic:updateClinicWithSchedule]", message);
      throw new Error("Não foi possível atualizar a clínica: " + message);
    }
  });

export const deleteClinic = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    try {
      const result = await callClinicApi("delete", undefined, data.clinicId) as { ok?: boolean; clinicId?: string } | null;
      if (!result?.ok || typeof result.clinicId !== "string") {
        throw new Error("Não foi possível excluir a clínica.");
      }
      return { ok: true, clinicId: result.clinicId };
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao excluir a clínica.");
      console.error("[Clinic:deleteClinic]", message);
      throw new Error("Não foi possível excluir a clínica: " + message);
    }
  });

export const createClinicWithSchedule = createServerFn({ method: "POST" })
  .inputValidator((input) => clinicInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const result = await callClinicApi("create", data) as { ok?: boolean; clinicId?: string; slotCount?: number } | null;
      if (!result?.ok || typeof result.clinicId !== "string") {
        throw new Error("Não foi possível concluir o cadastro da clínica.");
      }

      return {
        ok: true,
        clinicId: result.clinicId,
        slotCount: Number(result.slotCount ?? 0),
      };
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao cadastrar a clínica.");
      console.error("[Clinic:createClinicWithSchedule]", message);
      throw new Error("Não foi possível cadastrar a clínica: " + message);
    }
  });
