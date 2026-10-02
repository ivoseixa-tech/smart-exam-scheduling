import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ cnpj: z.string().regex(/^\d{14}$/) });

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(data.cnpj)}`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false as const, message: "CNPJ não encontrado ou serviço indisponível." };
    const result = await response.json() as Record<string, unknown>;
    return { ok: true as const, company: {
      cnpj: data.cnpj, legal_name: String(result.razao_social ?? ""), trade_name: String(result.nome_fantasia ?? ""),
      registration_status: String(result.descricao_situacao_cadastral ?? ""), cnae_code: String(result.cnae_fiscal ?? ""),
      cnae_description: String(result.cnae_fiscal_descricao ?? ""), email: String(result.email ?? ""), phone: String(result.ddd_telefone_1 ?? ""),
      street: String(result.logradouro ?? ""), number: String(result.numero ?? ""), complement: String(result.complemento ?? ""),
      district: String(result.bairro ?? ""), city: String(result.municipio ?? ""), state: String(result.uf ?? ""), postal_code: String(result.cep ?? ""),
    }};
  });