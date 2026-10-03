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
        preferred_language: "pt", is_active: true, agenda_login_code: loginCode,
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


export const createClinicWithSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
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
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master",
    });
    if (roleError || !isMaster) throw new Error("Acesso permitido somente ao usuário mestre.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: approvedCompanies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("id,status")
      .in("id", data.company_ids);

    if (companiesError) throw new Error("Não foi possível validar as empresas selecionadas.");
    if ((approvedCompanies ?? []).length !== data.company_ids.length || (approvedCompanies ?? []).some((company) => company.status !== "approved")) {
      throw new Error("Todas as empresas selecionadas precisam estar aprovadas.");
    }

    const { data: location, error: locationError } = await supabaseAdmin
      .from("exam_locations")
      .insert({
        name: data.name,
        street: data.street,
        number: data.number || null,
        complement: data.complement || null,
        district: data.district || null,
        city: data.city,
        state: data.state.toUpperCase(),
        postal_code: data.postal_code || null,
        phone: data.phone || null,
        is_active: true,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (locationError || !location) throw new Error(locationError?.message ?? "Não foi possível cadastrar a clínica.");

    const { error: companyLinkError } = await supabaseAdmin
      .from("exam_location_companies")
      .insert(data.company_ids.map((company_id) => ({ location_id: location.id, company_id })));

    if (companyLinkError) {
      await supabaseAdmin.from("exam_locations").delete().eq("id", location.id);
      throw new Error(companyLinkError.message);
    }

    const scheduleRows = data.schedule.map((rule) => ({
      location_id: location.id,
      weekday: rule.weekday,
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_minutes: rule.slot_minutes,
      is_active: true,
    }));

    const { error: scheduleError } = await supabaseAdmin
      .from("exam_location_schedule_rules")
      .insert(scheduleRows);

    if (scheduleError) {
      await supabaseAdmin.from("exam_location_companies").delete().eq("location_id", location.id);
      await supabaseAdmin.from("exam_locations").delete().eq("id", location.id);
      throw new Error(scheduleError.message);
    }

    const slots: { location_id: string; starts_at: string; ends_at: string; is_active: boolean; created_by: string }[] = [];
    const now = new Date();
    for (let offset = 0; offset < 180; offset += 1) {
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
      const weekday = day.getUTCDay();
      for (const rule of data.schedule.filter((item) => item.weekday === weekday)) {
        const [startHour, startMinute] = rule.start_time.split(":").map(Number);
        const [endHour, endMinute] = rule.end_time.split(":").map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        for (let minute = startMinutes; minute + rule.slot_minutes <= endMinutes; minute += rule.slot_minutes) {
          const dayIso = day.toISOString().slice(0, 10);
          const starts_at = `${dayIso}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00-03:00`;
          const endMinuteTotal = minute + rule.slot_minutes;
          const ends_at = `${dayIso}T${String(Math.floor(endMinuteTotal / 60)).padStart(2, "0")}:${String(endMinuteTotal % 60).padStart(2, "0")}:00-03:00`;
          slots.push({ location_id: location.id, starts_at, ends_at, is_active: true, created_by: context.userId });
        }
      }
    }

    for (let start = 0; start < slots.length; start += 500) {
      const { error: slotsError } = await supabaseAdmin
        .from("availability_slots")
        .insert(slots.slice(start, start + 500));
      if (slotsError) {
        await supabaseAdmin.from("exam_location_schedule_rules").delete().eq("location_id", location.id);
        await supabaseAdmin.from("exam_location_companies").delete().eq("location_id", location.id);
        await supabaseAdmin.from("exam_locations").delete().eq("id", location.id);
        throw new Error(slotsError.message);
      }
    }

    return { ok: true, locationId: location.id, slotCount: slots.length };
  });
