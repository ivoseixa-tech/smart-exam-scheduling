import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMasterImport, companyImportSchema, employeeImportSchema, type ImportOutcome } from "./bulk-import";

export const importMasterRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ kind: z.enum(["companies", "employees"]), rows: z.array(z.object({ row: z.number().int().min(2), data: z.record(z.string().max(500)) })).min(1).max(5) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: master, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    assertMasterImport(!roleError && master === true);
    const client = context.supabase;
    return Promise.all(data.rows.map(async (entry): Promise<ImportOutcome> => {
      const outcome = (status: ImportOutcome["status"], code: string): ImportOutcome => ({ row: entry.row, status, code });
      try {
        if (data.kind === "companies") {
          const checked = companyImportSchema.safeParse(entry.data);
          if (!checked.success) return outcome("error", "invalid:" + checked.error.issues.map(v => v.path.join(".")).join(", "));
          const v = checked.data;
          const { data: existing, error: readError } = await client.from("companies").select("id").eq("cnpj", v.cnpj).maybeSingle();
          if (readError) return outcome("error", "save_failed");
          if (existing) return outcome("skipped", "exists");
          const { findCompanyRegistry } = await import("./cnpj.server");
          const registry = await findCompanyRegistry(v.cnpj);
          if (!registry) return outcome("error", "registry_unavailable");
          const { error } = await client.from("companies").insert({ ...registry,
            legal_name: v.razao_social || registry.legal_name, trade_name: v.nome_fantasia || registry.trade_name || null,
            registration_status: v.situacao_cadastral || registry.registration_status || null,
            cnae_code: v.cnae || registry.cnae_code || null, cnae_description: v.descricao_cnae || registry.cnae_description || null,
            email: v.email || registry.email || null, phone: v.telefone || registry.phone || null,
            street: v.logradouro || registry.street || null, number: v.numero || registry.number || null,
            complement: v.complemento || registry.complement || null, district: v.bairro || registry.district || null,
            city: v.cidade || registry.city || null, state: v.uf || registry.state || null, postal_code: v.cep || registry.postal_code || null,
            status: "pending", created_by: context.userId,
          });
          return error ? outcome(error.code === "23505" ? "skipped" : "error", error.code === "23505" ? "exists" : "save_failed") : outcome("imported", "saved");
        }
        const checked = employeeImportSchema.safeParse(entry.data);
        if (!checked.success) return outcome("error", "invalid:" + checked.error.issues.map(v => v.path.join(".")).join(", "));
        const v = checked.data;
        const { data: company, error: companyError } = await client.from("companies").select("id,status").eq("cnpj", v.cnpj_empresa).maybeSingle();
        if (companyError || !company || company.status !== "approved") return outcome("error", "company_not_approved");
        const { data: existing, error: readError } = await client.from("employees").select("id").eq("company_id", company.id).eq("cpf", v.cpf).maybeSingle();
        if (readError) return outcome("error", "save_failed");
        if (existing) return outcome("skipped", "exists");
        const { error: functionError } = await client.from("occupational_functions").upsert({ company_id: company.id, name: v.funcao, created_by: context.userId }, { onConflict: "company_id,name", ignoreDuplicates: true });
        if (functionError) return outcome("error", "save_failed");
        const { data: fn } = await client.from("occupational_functions").select("id,is_active").eq("company_id", company.id).eq("name", v.funcao).single();
        if (!fn?.is_active) return outcome("error", "function_inactive");
        const { error } = await client.from("employees").insert({ company_id: company.id, full_name: v.nome_completo, cpf: v.cpf, rg: v.rg || null,
          birthplace: v.naturalidade, nationality: v.nacionalidade, birth_date: v.data_nascimento, sex: v.sexo, job_title: v.funcao,
          occupational_function_id: fn.id, admission_date: v.data_admissao || null, workplace: v.posto_trabalho, created_by: context.userId });
        return error ? outcome(error.code === "23505" ? "skipped" : "error", error.code === "23505" ? "exists" : "save_failed") : outcome("imported", "saved");
      } catch { return outcome("error", "save_failed"); }
    }));
  });