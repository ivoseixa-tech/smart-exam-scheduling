import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: authData, error: authError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }, { data: companies, error: companiesError }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id,full_name,company_id,is_active"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("companies").select("id,trade_name,legal_name"),
    ]);
    const error = authError ?? profilesError ?? rolesError ?? companiesError;
    if (error) throw new Error("Não foi possível carregar os usuários.");
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const roleById = new Map((roles ?? []).map((role) => [role.user_id, role.role]));
    const companyById = new Map((companies ?? []).map((company) => [company.id, company.trade_name || company.legal_name]));
    return authData.users.map((user) => {
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name ?? String(user.user_metadata?.["full_name"] ?? "Usuário"),
        companyName: profile?.company_id ? companyById.get(profile.company_id) ?? null : null,
        role: roleById.get(user.id) ?? "company_user",
        isActive: profile?.is_active ?? true,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      };
    });
  });

export const resetManagedUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error("Não foi possível alterar a senha deste usuário.");
    return { ok: true };
  });

export const setManagedUserApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), approved: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");
    if (data.userId === context.userId && !data.approved) throw new Error("O usuário mestre não pode suspender o próprio acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ is_active: data.approved }).eq("id", data.userId);
    if (error) throw new Error("Não foi possível alterar a aprovação deste usuário.");
    return { ok: true };
  });

export const createCompanyAgendaUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    companyId: z.string().uuid(),
    fullName: z.string().trim().min(2).max(120),
    password: z.string().min(8).max(72),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company, error: companyError } = await supabaseAdmin.from("companies").select("id,status").eq("id", data.companyId).maybeSingle();
    if (companyError || !company) throw new Error("Empresa não encontrada.");
    if (company.status !== "approved") throw new Error("A empresa precisa estar aprovada para receber acesso à agenda.");

    const loginCode = `AGENDA-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const authEmail = `${loginCode.toLowerCase()}@login.medagenda.local`;
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, login_code: loginCode, access_type: "company_agenda" },
    });
    if (authError || !created.user) throw new Error(authError?.message ?? "Não foi possível criar o usuário da empresa.");

    try {
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        id: created.user.id, company_id: data.companyId, full_name: data.fullName,
        preferred_language: "pt", is_active: true,
      });
      if (profileError) throw profileError;
      const { error: roleError2 } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "company_user" });
      if (roleError2) throw roleError2;
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(error instanceof Error ? error.message : "Não foi possível concluir o cadastro do acesso.");
    }
    return { ok: true, loginCode };
  });
