import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { signInWithUsername } from "@/lib/user-auth.functions";
import { useI18n } from "@/lib/i18n";
import { Activity, ArrowRight, Building2, CheckCircle2, Globe2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const { language, setLanguage } = useI18n();
  const login = useServerFn(signInWithUsername);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const copy = language === "pt" ? {
    title: "Saúde ocupacional, organizada.", subtitle: "Empresas, funcionários, exames e agenda em um único ambiente seguro.",
    signIn: "Entrar", signUp: "Criar acesso", email: "Nome de usuário", password: "Senha", name: "Nome completo",
    new: "Primeiro acesso?", existing: "Já possui acesso?", google: "Continuar com Google", submitIn: "Acessar sistema", submitUp: "Criar minha conta",
    feature1: "Dados separados por empresa", feature2: "Agenda e exames integrados", feature3: "Acesso aprovado pelo usuário mestre", pending: "Cadastro recebido. Aguarde a aprovação do usuário mestre para acessar o sistema.",
  } : {
    title: "Occupational health, organized.", subtitle: "Companies, employees, exams and schedules in one secure workspace.",
    signIn: "Sign in", signUp: "Create access", email: "Username", password: "Password", name: "Full name",
    new: "First access?", existing: "Already registered?", google: "Continue with Google", submitIn: "Open system", submitUp: "Create my account",
    feature1: "Company-isolated data", feature2: "Integrated schedule and exams", feature3: "Access approved by the master user", pending: "Registration received. Wait for the master user to approve your access.",
  };

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const tokens = await login({ data: { username: email, password } });
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw error;
      await navigate({ to: "/dashboard" });
    } catch (error) { setMessage(error instanceof Error ? error.message : language === "pt" ? "Não foi possível entrar." : "Could not sign in."); }
    finally { setBusy(false); }
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
      <div className="mb-8"><p className="text-sm font-medium text-primary">MedAgenda Ocupacional</p><h2 className="mt-2 text-3xl font-semibold">{copy.signIn}</h2></div>
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2"><Label htmlFor="email">{copy.email}</Label><div className="relative"><Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input id="email" className="pl-10" type="text" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={255}/></div></div>
        <div className="space-y-2"><Label htmlFor="password">{copy.password}</Label><div className="relative"><LockKeyhole className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input id="password" className="pl-10" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} maxLength={72}/></div></div>
        {message && <p className="rounded-md border border-border bg-muted p-3 text-sm">{message}</p>}
        <Button className="h-11 w-full" disabled={busy}>{copy.submitIn}<ArrowRight/></Button>
      </form>
    </div></section>
  </main>;
}