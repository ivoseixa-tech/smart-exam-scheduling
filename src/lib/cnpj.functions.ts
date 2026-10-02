import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ cnpj: z.string().regex(/^\d{14}$/) });

type CompanyLookup = {
  cnpj: string;
  legal_name: string;
  trade_name: string;
  registration_status: string;
  cnae_code: string;
  cnae_description: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  postal_code: string;
};

const asText = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

function normalizeBrasilApi(cnpj: string, result: Record<string, unknown>): CompanyLookup {
  return {
    cnpj,
    legal_name: asText(result["razao_social"]),
    trade_name: asText(result["nome_fantasia"]),
    registration_status: asText(result["descricao_situacao_cadastral"]),
    cnae_code: asText(result["cnae_fiscal"]),
    cnae_description: asText(result["cnae_fiscal_descricao"]),
    email: asText(result["email"]),
    phone: asText(result["ddd_telefone_1"]),
    street: asText(result["logradouro"]),
    number: asText(result["numero"]),
    complement: asText(result["complemento"]),
    district: asText(result["bairro"]),
    city: asText(result["municipio"]),
    state: asText(result["uf"]),
    postal_code: asText(result["cep"]),
  };
}

function normalizeReceitaWs(cnpj: string, result: Record<string, unknown>): CompanyLookup {
  const activity = Array.isArray(result["atividade_principal"]) ? result["atividade_principal"][0] as Record<string, unknown> | undefined : undefined;
  return {
    cnpj,
    legal_name: asText(result["nome"]),
    trade_name: asText(result["fantasia"]),
    registration_status: asText(result["situacao"]),
    cnae_code: asText(activity?.["code"]),
    cnae_description: asText(activity?.["text"]),
    email: asText(result["email"]),
    phone: asText(result["telefone"]),
    street: asText(result["logradouro"]),
    number: asText(result["numero"]),
    complement: asText(result["complemento"]),
    district: asText(result["bairro"]),
    city: asText(result["municipio"]),
    state: asText(result["uf"]),
    postal_code: asText(result["cep"]),
  };
}

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const sources = [
      { url: `https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(data.cnpj)}`, normalize: normalizeBrasilApi },
      { url: `https://receitaws.com.br/v1/cnpj/${encodeURIComponent(data.cnpj)}`, normalize: normalizeReceitaWs },
    ];

    for (const source of sources) {
      try {
        const response = await fetch(source.url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) continue;
        const result = await response.json() as Record<string, unknown>;
        if (result["status"] === "ERROR") continue;
        const company = source.normalize(data.cnpj, result);
        if (company.legal_name) return { ok: true as const, company };
      } catch {
        // Try the next public registry source when one is temporarily unavailable.
      }
    }

    return { ok: false as const, message: "Não foi possível consultar este CNPJ agora. Confira o número e tente novamente." };
  });