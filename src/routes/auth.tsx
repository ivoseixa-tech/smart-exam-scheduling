import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Activity, ArrowRight, Building2, CheckCircle2, Globe2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Acesso | MedAgenda Ocupacional" },
    { name: "description", content: "Acesso seguro à gestão de exames ocupacionais." },
    { property: "og:title", content: "Acesso | MedAgenda Ocupacional" },
    { property: "og:description", content: "Acesso seguro à gestão de exames ocupacionais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [language, setLanguage] = useState<"pt" | "en">("pt");
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const copy = language === "pt" ? {
    title: "Saúde ocupacional, organizada.", subtitle: "Empresas, funcionários, exames e agenda em um único ambiente seguro.",
    signIn: "Entrar", signUp: "Criar acesso", email: "E-mail", password: "Senha", name: "Nome completo",
    new: "Primeiro acesso?", existing: "Já possui acesso?", google: "Continuar com Google", submitIn: "Acessar sistema", submitUp: "Criar minha conta",
    confirm: "Enviamos um link de confirmação para seu e-mail. Verifique também a caixa de spam.", resend: "Reenviar e-mail", resent: "Novo e-mail de confirmação enviado.", feature1: "Dados separados por empresa", feature2: "Agenda e exames integrados", feature3: "Revisão de CNPJ pelo administrador",
  } : {
    title: "Occupational health, organized.", subtitle: "Companies, employees, exams and schedules in one secure workspace.",
    signIn: "Sign in", signUp: "Create access", email: "Email", password: "Password", name: "Full name",
    new: "First access?", existing: "Already registered?", google: "Continue with Google", submitIn: "Open system", submitUp: "Create my account",
    confirm: "We sent a confirmation link to your email. Please also check your spam folder.", resend: "Resend email", resent: "A new confirmation email was sent.", feature1: "Company-isolated data", feature2: "Integrated schedule and exams", feature3: "Admin CNPJ review",
  };

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMessage(error.message); else await navigate({ to: "/dashboard" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { full_name: fullName.trim(), language },
        },
      });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage(copy.confirm);
      else { await supabase.rpc("initialize_profile", { _full_name: fullName.trim(), _language: language }); await navigate({ to: "/dashboard" }); }
    }
    setBusy(false);
  }

  async function resendConfirmation() {
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setMessage(error ? error.message : copy.resent);
    setBusy(false);
  }

  async function googleSignIn() {
    setBusy(true); const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setMessage(result.error.message); setBusy(false); return; }
    if (!result.redirected) await navigate({ to: "/dashboard" });
  }

  return <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden overflow-hidden bg-brand p-12 text-brand-foreground lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3 text-xl font-semibold"><span className="grid size-10 place-items-center rounded-md bg-highlight text-highlight-foreground"><Activity /></span> MedAgenda</div>
      <div className="max-w-xl"><p className="mb-5 text-sm font-semibold uppercase text-highlight">Gestão de saúde ocupacional</p><h1 className="text-5xl font-semibold leading-tight">{copy.title}</h1><p className="mt-6 max-w-lg text-lg text-brand-foreground/75">{copy.subtitle}</p>
        <div className="mt-10 space-y-4">{[copy.feature1,copy.feature2,copy.feature3].map(item => <div key={item} className="flex items-center gap-3"><CheckCircle2 className="text-highlight"/><span>{item}</span></div>)}</div>
      </div><p className="text-sm text-brand-foreground/55">Proteção de dados e acesso por organização</p>
    </section>
    <section className="flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-md">
      <div className="mb-10 flex items-center justify-between lg:justify-end"><div className="flex items-center gap-2 text-lg font-semibold lg:hidden"><Activity className="text-primary"/> MedAgenda</div><Button variant="ghost" size="sm" onClick={() => setLanguage(language === "pt" ? "en" : "pt")}><Globe2/> {language.toUpperCase()}</Button></div>
      <div className="mb-8"><p className="text-sm font-medium text-primary">MedAgenda Ocupacional</p><h2 className="mt-2 text-3xl font-semibold">{mode === "signin" ? copy.signIn : copy.signUp}</h2></div>
      <form className="space-y-5" onSubmit={submit}>{mode === "signup" && <div className="space-y-2"><Label htmlFor="name">{copy.name}</Label><div className="relative"><UserRound className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input id="name" className="pl-10" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={120} required/></div></div>}
        <div className="space-y-2"><Label htmlFor="email">{copy.email}</Label><div className="relative"><Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input id="email" className="pl-10" type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={255}/></div></div>
        <div className="space-y-2"><Label htmlFor="password">{copy.password}</Label><div className="relative"><LockKeyhole className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input id="password" className="pl-10" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} maxLength={72}/></div></div>
        {message && <div className="space-y-3 rounded-md border border-border bg-muted p-3 text-sm"><p>{message}</p>{mode === "signup" && message === copy.confirm && <Button type="button" variant="outline" size="sm" onClick={resendConfirmation} disabled={busy}>{copy.resend}</Button>}</div>}
        <Button className="h-11 w-full" disabled={busy}>{mode === "signin" ? copy.submitIn : copy.submitUp}<ArrowRight/></Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>OU<span className="h-px flex-1 bg-border"/></div>
      <Button variant="outline" className="h-11 w-full" onClick={googleSignIn} disabled={busy}><Building2/>{copy.google}</Button>
      <p className="mt-7 text-center text-sm text-muted-foreground">{mode === "signin" ? copy.new : copy.existing} <button className="font-semibold text-primary" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? copy.signUp : copy.signIn}</button></p>
    </div></section>
  </main>;
}