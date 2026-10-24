import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canDeleteManagedUser, managedUserEditSchema, managedUserSchema, usernameSchema } from "@/lib/user-access";

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: authData, error: authError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }, { data: companies, error: companiesError }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id,full_name,company_id,is_active,username"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("companies").select("id,trade_name,legal_name"),
    ]);
    const error = authError ?? profilesError ?? rolesError ?? companiesError;
    if (error) throw new Error("Não foi possível carregar os usuários.");
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const masterIds = new Set((roles ?? []).filter((role) => role.role === "master").map((role) => role.user_id));
    const companyById = new Map((companies ?? []).map((company) => [company.id, company.trade_name || company.legal_name]));
    return authData.users.filter((user) => !user.deleted_at).map((user) => {
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        username: profile?.username ?? "",
        fullName: profile?.full_name ?? String(user.user_metadata?.["full_name"] ?? "Usuário"),
        companyName: profile?.company_id ? companyById.get(profile.company_id) ?? null : null,
        companyId: profile?.company_id ?? null,
        role: masterIds.has(user.id) ? "master" : "company_user",
        isSelf: user.id === context.userId,
        isActive: profile?.is_active ?? false,
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
    const { error: profileError } = await supabaseAdmin.from("profiles").update({ initial_password_pending: true }).eq("id", data.userId);
    if (profileError) throw new Error("Senha alterada, mas não foi possível marcar o primeiro acesso.");
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
    if (!data.approved) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
      if (banError) throw new Error("Acesso bloqueado; não foi possível suspender a autenticação.");
    } else {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
      if (banError) throw new Error("Não foi possível reativar a autenticação.");
    }
    return { ok: true };
  });

export const createCompanyAgendaUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    username: usernameSchema,
    email: z.string().trim().email().max(255),
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

    const loginCode = data.username;
    const authEmail = data.email;
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, login_code: loginCode, access_type: "company_agenda" },
    });
    if (authError || !created.user) throw new Error(authError?.message ?? "Não foi possível criar o usuário da empresa.");

    try {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: created.user.id, company_id: data.companyId, full_name: data.fullName,
        preferred_language: "pt", is_active: true,
        username: loginCode.toLowerCase(), initial_password_pending: true,
      });
      if (profileError) throw profileError;
      const { error: roleError2 } = await supabaseAdmin.from("user_roles").upsert({ user_id: created.user.id, role: "company_user" }, {onConflict: "user_id,role"});
      if (roleError2) throw roleError2;
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(error instanceof Error ? error.message : "Não foi possível concluir o cadastro do acesso.");
    }
    return { ok: true, loginCode };
  });

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => managedUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (error || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company } = await context.supabase.from("companies").select("id,status").eq("id", data.companyId).single();
    if (company?.status !== "approved") throw new Error("Selecione uma empresa aprovada. / Select an approved company.");
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("username", data.username).maybeSingle();
    if (existing) throw new Error("Nome de usuário já utilizado. / Username already taken.");
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true, user_metadata: { full_name: data.fullName } });
    if (authError || !created.user) throw new Error("Não foi possível criar o acesso. Confira o e-mail e a senha. / Could not create account. Check email and password.");
    const id = created.user.id;
    try {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({ id, full_name: data.fullName, username: data.username, company_id: data.companyId, is_active: data.active, initial_password_pending: true, preferred_language: "pt" });
      if (profileError) throw profileError;
      const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: id, role: "company_user" }, { onConflict: "user_id,role" });
      if (roleError) throw roleError;
    } catch {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error("Não foi possível concluir o cadastro. / Could not finish registration.");
    }
    return { ok: true };
  });

export const setManagedUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), username: usernameSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (!isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ username: data.username }).eq("id", data.userId);
    if (error) throw new Error("Nome de usuário inválido ou já utilizado. / Invalid or taken username.");
    return { ok: true };
  });

export const updateManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => managedUserEditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre. / Master access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: target, error: targetError }, { data: targetRoles, error: targetRoleError }, { data: profile, error: profileError }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(data.userId),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
      supabaseAdmin.from("profiles").select("company_id").eq("id", data.userId).single(),
    ]);
    if (targetError || targetRoleError || profileError || !target.user || !target.user.email || target.user.deleted_at || !profile) throw new Error("Usuário não encontrado. / User not found.");
    const targetIsMaster = targetRoles?.some((role) => role.role === "master") ?? false;
    if (targetIsMaster && data.companyId !== profile.company_id) throw new Error("O vínculo do mestre não pode ser alterado. / Master company assignment cannot be changed.");
    if (!targetIsMaster && !data.companyId) throw new Error("Selecione uma empresa aprovada. / Select an approved company.");
    if (data.companyId) {
      const { data: company, error } = await context.supabase.from("companies").select("status").eq("id", data.companyId).single();
      if (error || company?.status !== "approved") throw new Error("Selecione uma empresa aprovada. / Select an approved company.");
    }
    const { data: existing, error: lookupError } = await supabaseAdmin.from("profiles").select("id").eq("username", data.username).neq("id", data.userId).maybeSingle();
    if (lookupError || existing) throw new Error("Nome de usuário já utilizado. / Username already taken.");
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true, user_metadata: { full_name: data.fullName } });
    if (authError) throw new Error("Não foi possível atualizar o usuário. Confira o e-mail. / Could not update user. Check email.");
    const { error: updateError } = await supabaseAdmin.from("profiles").update({ username: data.username, full_name: data.fullName, company_id: data.companyId }).eq("id", data.userId);
    if (updateError) {
      const { error: restoreError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: target.user.email, email_confirm: true, user_metadata: target.user.user_metadata });
      if (restoreError) throw new Error("Cadastro não salvo; confira o e-mail antes de tentar novamente. / Record not saved; verify the email before retrying.");
      throw new Error("Não foi possível salvar o usuário. / Could not save user.");
    }
    return { ok: true };
  });

export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "master" });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre. / Master access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: targetRoleError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (targetRoleError) throw new Error("Não foi possível verificar o usuário. / Could not verify user.");
    if (!canDeleteManagedUser(context.userId, data.userId, roles?.some((role) => role.role === "master") ?? false)) throw new Error("Contas mestre não podem ser excluídas. / Master accounts cannot be deleted.");
    const { data: target, error: targetError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (targetError || !target.user || target.user.deleted_at) throw new Error("Usuário não encontrado. / User not found.");
    const { error: profileError } = await supabaseAdmin.from("profiles").update({ is_active: false }).eq("id", data.userId).select("id").single();
    if (profileError) throw new Error("Não foi possível bloquear o acesso para exclusão. / Could not block access for deletion.");
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId, true);
    if (deleteError) throw new Error("O acesso foi desabilitado, mas a exclusão não foi concluída. Tente novamente. / Access disabled, but deletion failed. Please retry.");
    return { ok: true };
  });
