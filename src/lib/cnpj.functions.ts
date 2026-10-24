import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ cnpj: z.string().regex(/^\d{14}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { findCompanyRegistry } = await import("./cnpj.server");
    const company = await findCompanyRegistry(data.cnpj);
    return company ? { ok: true as const, company } : { ok: false as const, message: "Não foi possível consultar este CNPJ agora. Confira o número e tente novamente." };
  });
