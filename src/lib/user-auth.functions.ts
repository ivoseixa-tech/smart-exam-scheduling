import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { passwordChangeSchema } from "@/lib/user-access";

export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ username: z.string().trim().min(3).max(255), password: z.string().min(1).max(72) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");
    const identifier = data.username.toLowerCase();
    let email = identifier;
    if (!identifier.includes("@")) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("username", identifier).maybeSingle();
      if (profile) {
        const { data: user } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        email = user.user?.email ?? "invalid@login.medagenda.local";
      } else email = "invalid@login.medagenda.local";
    }
    const client = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !auth.user || !auth.session) throw new Error("Usuário ou senha inválidos. / Invalid username or password.");
    const { data: profile } = await supabaseAdmin.from("profiles").select("is_active").eq("id", auth.user.id).maybeSingle();
    if (!profile?.is_active) {
      await client.auth.signOut();
      throw new Error("Acesso desabilitado. Consulte o mestre. / Access disabled. Contact the master.");
    }
    return { access_token: auth.session.access_token, refresh_token: auth.session.refresh_token };
  });

export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => passwordChangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("is_active").eq("id", context.userId).single();
    if (!profile?.is_active) throw new Error("Acesso desabilitado. / Access disabled.");
    const { error } = await context.supabase.auth.updateUser({ password: data.password, current_password: data.currentPassword });
    if (error) throw new Error("Confira a senha atual e tente novamente. / Check your current password and try again.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: saveError } = await supabaseAdmin.from("profiles").update({ initial_password_pending: false }).eq("id", context.userId);
    if (saveError) throw new Error("Senha alterada; atualize a página. / Password changed; refresh the page.");
    return { ok: true };
  });