import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type ClinicSaveData = {
  name: string;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  phone: string | null;
  company_ids: string[];
  schedule: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
    slot_minutes: number;
  }>;
};

export const saveClinicFromMaster = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { locationId: string | null; clinic: ClinicSaveData } }) => {
    const request = getRequest();
    const authorization = request?.headers?.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new Error("Sessão não autenticada. Entre novamente no sistema.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = authorization.slice("Bearer ".length).trim();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      throw new Error("Sessão expirada. Entre novamente no sistema.");
    }

    const { data: roles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);
    if (roleError) throw roleError;
    if (!roles?.some((row) => row.role === "master")) {
      throw new Error("Acesso não autorizado para cadastrar clínicas.");
    }

    const clinic = data.clinic;
    if (!clinic.name.trim() || !clinic.street.trim() || !clinic.city.trim() || clinic.state.trim().length !== 2) {
      throw new Error("Preencha nome, endereço, cidade e UF da clínica.");
    }
    if (!clinic.company_ids.length) {
      throw new Error("Selecione pelo menos uma empresa aprovada.");
    }
    if (!clinic.schedule.length) {
      throw new Error("Configure pelo menos um dia de atendimento.");
    }

    const { data: locationId, error: saveError } = await supabaseAdmin.rpc("save_exam_location_for_user", {
      p_location_id: data.locationId,
      p_data: clinic,
      p_user_id: authData.user.id,
    });

    if (saveError) {
      console.error("[Clinic:save]", saveError.message);
      throw new Error(saveError.message || "Não foi possível salvar a clínica.");
    }
    if (!locationId) throw new Error("O banco não retornou o ID da clínica salva.");

    return { locationId };
  });
