import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { neonConfig, Pool } from "@neondatabase/serverless";
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

type ClinicAuth = {
  userId: string;
  role?: string;
  email?: string;
};

function getSupabaseServerConfig() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !key) {
    throw new Error("Configuração do Supabase não disponível no ambiente do servidor.");
  }

  return { url: url.replace(/\/$/, ""), key };
}

async function authenticateClinicRequest(): Promise<ClinicAuth> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Não autenticado.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) {
    throw new Error("Sessão inválida.");
  }

  const { url, key } = getSupabaseServerConfig();

  // Validate the session directly with Supabase Auth.
  // The clinic module intentionally does not use the Supabase JS auth verifier,
  // avoiding any local JWKS/JWK lookup in this server function.
  const authResponse = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!authResponse.ok) {
    throw new Error("Sessão inválida ou expirada.");
  }

  const authData = await authResponse.json() as {
    id?: string;
    role?: string;
    email?: string;
    user?: { id?: string; role?: string; email?: string };
  };

  const user = authData.user ?? authData;
  if (!user.id) {
    throw new Error("Usuário autenticado não identificado.");
  }

  // Check the existing master role through Supabase REST instead of the
  // Supabase JS client. This keeps the clinic flow outside the SDK/JWKS path.
  const roleResponse = await fetch(`${url}/rest/v1/rpc/has_role`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      _user_id: user.id,
      _role: "master",
    }),
  });

  if (!roleResponse.ok) {
    throw new Error("Não foi possível validar a permissão do usuário.");
  }

  const roleData = await roleResponse.json();
  const isMaster = roleData === true || roleData?.data === true || roleData?.result === true;

  if (!isMaster) {
    throw new Error("Acesso permitido somente ao usuário mestre.");
  }

  return {
    userId: user.id,
    role: user.role,
    email: user.email,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      detail?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const message = typeof candidate.message === "string" ? candidate.message : "";
    const detail = typeof candidate.detail === "string" ? candidate.detail : "";
    const hint = typeof candidate.hint === "string" ? candidate.hint : "";
    const code = typeof candidate.code === "string" ? candidate.code : "";

    const parts = [message, detail, hint, code ? `[SQLSTATE ${code}]` : ""].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function getClinicPool() {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Conexão PostgreSQL do Neon não configurada no ambiente do servidor.");
  }

  try {
    new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL/NEON_DATABASE_URL precisa ser a URL completa de conexão do PostgreSQL do Neon.");
  }

  if (typeof WebSocket !== "undefined") {
    neonConfig.webSocketConstructor = WebSocket;
  }

  return new Pool({ connectionString: databaseUrl, max: 1 });
}

export const listClinics = createServerFn({ method: "GET" })
  .handler(async () => {
    await authenticateClinicRequest();

    const pool = getClinicPool();
    try {
      const { rows } = await pool.query("SELECT public.list_clinics() AS data");
      const data = rows[0]?.data;
      if (!Array.isArray(data)) {
        return [];
      }
      return JSON.parse(JSON.stringify(data)) as unknown[];
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao consultar as clínicas.");
      console.error("[Clinic:listClinics]", message);
      throw new Error("Não foi possível carregar as clínicas: " + message);
    } finally {
      await pool.end();
    }
  });

export const createClinicWithSchedule = createServerFn({ method: "POST" })
  .inputValidator((input) => clinicInput.parse(input))
  .handler(async ({ data }) => {
    const auth = await authenticateClinicRequest();

    const pool = getClinicPool();
    try {
      const { rows } = await pool.query(
        "SELECT public.create_clinic_with_schedule($1::jsonb, $2::uuid) AS data",
        [JSON.stringify(data), auth.userId],
      );

      const result = rows[0]?.data as { ok?: boolean; clinicId?: string; slotCount?: number } | null;
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
    } finally {
      await pool.end();
    }
  });
