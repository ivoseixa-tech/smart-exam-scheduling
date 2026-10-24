import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { employeeSnapshotSchema } from "@/lib/appointment-record";

const appointmentInput = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  clinicId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  assessmentType: z.enum(["admission", "periodic", "return_to_work", "risk_change", "dismissal"]),
  jobTitle: z.string().trim().min(1).max(200),
  employeeSnapshot: employeeSnapshotSchema.optional(),
  examIds: z.array(z.string().uuid()).min(1),
  notes: z.string().trim().max(2000).nullable().optional(),
});

type Clinic = {
  id: string;
  name: string;
  is_active: boolean;
  companies?: { company_id: string }[];
  schedule_rules?: { weekday: number; start_time: string; end_time: string; slot_minutes: number; is_active: boolean }[];
};

type SupabaseAdminClient = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

async function getClinicsFromSupabase(supabaseAdmin: SupabaseAdminClient, companyId: string): Promise<Clinic[]> {
  const { data: links, error: linkError } = await supabaseAdmin
    .from("exam_location_companies")
    .select("location_id,company_id")
    .eq("company_id", companyId);
  if (linkError) throw linkError;
  const locationIds = Array.from(new Set((links ?? []).map((row: { location_id: string }) => row.location_id)));
  if (!locationIds.length) return [];

  const [{ data: locations, error: locationError }, { data: schedules, error: scheduleError }] = await Promise.all([
    supabaseAdmin
      .from("exam_locations")
      .select("id,name,is_active")
      .in("id", locationIds)
      .eq("is_active", true),
    supabaseAdmin
      .from("exam_location_schedule_rules")
      .select("id,location_id,weekday,start_time,end_time,slot_minutes,is_active")
      .in("location_id", locationIds)
      .eq("is_active", true),
  ]);
  if (locationError) throw locationError;
  if (scheduleError) throw scheduleError;

  return (locations ?? []).map((location: { id: string; name: string; is_active: boolean }) => ({
    ...location,
    companies: (links ?? []).filter((link: { location_id: string }) => link.location_id === location.id),
    schedule_rules: (schedules ?? []).filter((rule: { location_id: string }) => rule.location_id === location.id),
  })) as Clinic[];
}

function safeError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return message.trim() || fallback;
}

export const createAppointmentFromClinic = createServerFn({ method: "POST" })
  .inputValidator((input) => appointmentInput.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const authorization = request?.headers?.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new Error("Não autenticado.");
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const token = authorization.slice("Bearer ".length).trim();
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authData.user) throw new Error("Sessão expirada.");

      const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
        supabaseAdmin.from("profiles").select("company_id,is_active").eq("id", authData.user.id).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", authData.user.id),
      ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      if (!profile?.is_active) throw new Error("Usuário inativo.");
      const isMaster = Boolean(roleRows?.some((row) => row.role === "master"));
      if (!isMaster && profile.company_id !== data.companyId) throw new Error("Empresa não autorizada.");

      const { data: employee, error: employeeError } = await supabaseAdmin
        .from("employees")
        .select("id,company_id,is_active,occupational_function_id,cpf")
        .eq("id", data.employeeId)
        .maybeSingle();
      if (employeeError) throw employeeError;
      if (!employee?.is_active || employee.company_id !== data.companyId) throw new Error("Funcionário indisponível.");
      if (data.employeeSnapshot && data.employeeSnapshot.cpf !== employee.cpf) throw new Error("O CPF deve corresponder ao funcionário selecionado.");
      const functionId = data.employeeSnapshot?.occupational_function_id ?? employee.occupational_function_id;
      if (functionId) {
        const { data: selectedFunction, error: functionError } = await supabaseAdmin.from("occupational_functions")
          .select("id").eq("id", functionId).eq("company_id", data.companyId).eq("is_active", true).maybeSingle();
        if (functionError || !selectedFunction) throw new Error("Função indisponível para esta empresa.");
      }

      const clinics = await getClinicsFromSupabase(supabaseAdmin, data.companyId);
      const clinic = clinics.find((item) =>
        item.id === data.clinicId &&
        item.is_active &&
        Boolean(item.companies?.some((link) => link.company_id === data.companyId)),
      );
      if (!clinic) throw new Error("Clínica não habilitada para esta empresa.");

      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        throw new Error("Horário de atendimento inválido.");
      }
      if (startsAt <= new Date()) throw new Error("O horário selecionado já passou.");
      if (endsAt.getTime() - startsAt.getTime() > 4 * 60 * 60 * 1000) {
        throw new Error("Duração do atendimento inválida.");
      }

      const { data: exams, error: examsError } = await supabaseAdmin
        .from("exams")
        .select("id")
        .in("id", data.examIds)
        .eq("is_active", true);
      if (examsError) throw examsError;
      if ((exams?.length ?? 0) !== data.examIds.length) throw new Error("Há exame inválido ou inativo.");

      const { data: employeeExams, error: employeeExamsError } = await supabaseAdmin
        .from("employee_exams")
        .select("exam_id")
        .eq("employee_id", data.employeeId)
        .in("exam_id", data.examIds);
      if (employeeExamsError) throw employeeExamsError;

      const employeeExamSet = new Set((employeeExams ?? []).map((row) => row.exam_id));
      let functionExamSet = new Set<string>();
      if (functionId) {
        const { data: functionExams, error: functionExamsError } = await supabaseAdmin
          .from("occupational_function_exams")
          .select("exam_id")
          .eq("function_id", functionId)
          .in("exam_id", data.examIds);
        if (functionExamsError) throw functionExamsError;
        functionExamSet = new Set((functionExams ?? []).map((row) => row.exam_id));
      }

      const [{ data: companyAvailable, error: availableError }, { data: companySettings, error: settingsError }] = await Promise.all([
        supabaseAdmin.from("exams").select("id").in("id", data.examIds).eq("is_active", true).eq("available_to_companies", true),
        supabaseAdmin.from("company_exam_settings").select("exam_id,enabled").eq("company_id", data.companyId).in("exam_id", data.examIds),
      ]);
      if (availableError) throw availableError;
      if (settingsError) throw settingsError;
      const disabledSet = new Set((companySettings ?? []).filter((row) => !row.enabled).map((row) => row.exam_id));
      const companyExamSet = new Set((companyAvailable ?? []).map((row) => row.id).filter((id) => !disabledSet.has(id)));

      const unauthorizedExam = !isMaster && data.examIds.some(
        (examId) => !employeeExamSet.has(examId) && !functionExamSet.has(examId) && !companyExamSet.has(examId),
      );
      if (unauthorizedExam) {
        throw new Error("Um ou mais exames não estão habilitados para esta empresa.");
      }

      const { data: conflicts, error: conflictError } = await supabaseAdmin
        .from("appointments")
        .select("id")
         .eq("company_id", data.companyId)
        .eq("location_id", clinic.id)
        .neq("status", "cancelled")
        .lt("starts_at", data.endsAt)
        .gt("ends_at", data.startsAt)
        .limit(1);
      if (conflictError) throw conflictError;
      if (conflicts?.length) throw new Error("Já existe um agendamento neste horário para a empresa.");

      const { data: created, error: createError } = await supabaseAdmin
        .from("appointments")
        .insert({
          company_id: data.companyId,
          employee_id: data.employeeId,
          assessment_type: data.assessmentType,
          job_title: data.jobTitle,
          ...(data.employeeSnapshot ? { employee_snapshot: { ...data.employeeSnapshot, job_title: data.jobTitle } } : {}),
          starts_at: data.startsAt,
          ends_at: data.endsAt,
          location: clinic.name,
          location_id: clinic.id,
          slot_id: null,
          notes: data.notes?.trim() || null,
          created_by: authData.user.id,
          updated_by: authData.user.id,
        })
        .select("id,appointment_code")
        .single();
      if (createError || !created) throw createError || new Error("Não foi possível criar o agendamento.");

      const { error: examInsertError } = await supabaseAdmin
        .from("appointment_exams")
        .insert(data.examIds.map((exam_id) => ({ appointment_id: created.id, exam_id })));
      if (examInsertError) {
        await supabaseAdmin.from("appointment_exams").delete().eq("appointment_id", created.id);
        await supabaseAdmin.from("appointments").delete().eq("id", created.id);
        throw examInsertError;
      }

      await supabaseAdmin.from("appointment_history").insert({
        appointment_id: created.id,
        action: "created",
        new_status: "scheduled",
        actor_id: authData.user.id,
      });

      if (!isMaster) {
        const { data: masters } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "master");
        if (masters?.length) {
          await supabaseAdmin.from("notifications").insert(
            masters.map((master) => ({
              recipient_id: master.user_id,
              type: "appointment_created",
              appointment_id: created.id,
            })),
          );
        }
      }

      return { ok: true, appointmentId: created.id, appointmentCode: created.appointment_code };
    } catch (error) {
      const message = safeError(error, "Não foi possível criar o agendamento.");
      console.error("[Appointment:createAppointmentFromClinic]", message);
      throw new Error(message);
    }
  });
