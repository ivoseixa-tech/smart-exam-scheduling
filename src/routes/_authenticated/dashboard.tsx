import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Activity, Bell, Building2, CalendarDays, Check, ChevronRight, ClipboardPlus, Clock3, Download, FileCheck2, LayoutDashboard, MapPin, Menu, Plus, Search, Stethoscope, UserRound, UsersRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { lookupCnpj } from "@/lib/cnpj.functions";
import { createCompanyAgendaUser } from "@/lib/admin-users.functions";
import { createAppointmentFromClinic } from "@/lib/appointment.functions";
import { loadClinicsForCurrentUser, saveClinicFromMaster } from "@/lib/clinic.functions";
import { UserManagement } from "@/components/UserManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadAppointmentGuide } from "@/lib/appointment-guide";

type Section = "dashboard" | "companies" | "employees" | "exams" | "locations" | "schedule" | "users";
type Company = { id:string; cnpj:string; legal_name:string; trade_name:string|null; status:"pending"|"approved"|"rejected"|"inactive"; street?:string|null; number?:string|null; complement?:string|null; district?:string|null; city:string|null; state:string|null; postal_code?:string|null; registration_status:string|null; cnae_code?:string|null; cnae_description?:string|null; email?:string|null; phone?:string|null; created_at:string };
type Employee = { id:string; company_id:string; full_name:string; cpf:string; rg:string|null; birthplace:string; nationality:string; birth_date:string; sex:string; job_title:string; occupational_function_id:string|null; admission_date:string|null; workplace:string; is_active:boolean };
type Exam = { id:string; category:"clinical"|"complementary"; name_pt:string; name_en:string; duration_minutes:number; is_active:boolean };
type Appointment = { id:string; company_id:string; employee_id:string; assessment_type:string; job_title:string|null; starts_at:string; ends_at:string; location:string; location_id:string|null; notes:string|null; status:"scheduled"|"confirmed"|"completed"|"cancelled"; employees?: { full_name:string; cpf:string } | null; appointment_exams?: { exams:{ name_pt:string; name_en:string }|null }[] };
type Profile = { id:string; company_id:string|null; full_name:string; preferred_language:string; is_active:boolean };
type OccupationalFunction = { id:string; company_id:string; name:string; is_active:boolean; occupational_function_exams?:{exam_id:string}[] };
type ExamLocation = { id:string; name:string; street:string; number:string|null; complement:string|null; district:string|null; city:string; state:string; postal_code:string|null; phone:string|null; is_active:boolean };
type AvailabilitySlot = { id:string; location_id:string; starts_at:string; ends_at:string; is_active:boolean; exam_locations?:{name:string}|null };
type LocationCompany = { location_id:string; company_id:string };
type LocationScheduleRule = { id:string; location_id:string; weekday:number; start_time:string; end_time:string; slot_minutes:number; is_active:boolean };
type Notification = { id:string; appointment_id:string|null; is_read:boolean; created_at:string };

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Painel | MedAgenda Ocupacional" }, { name: "description", content: "Gestão de empresas, funcionários e exames ocupacionais." },
    { property: "og:title", content: "Painel | MedAgenda Ocupacional" }, { property: "og:description", content: "Gestão de empresas, funcionários e exames ocupacionais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}),
  component: DashboardPage,
});

function DashboardPage() {
  const { language, setLanguage, t } = useI18n(); const navigate = useNavigate();
  const [section,setSection]=useState<Section>("dashboard"); const [mobile,setMobile]=useState(false); const [loading,setLoading]=useState(true);
  const [profile,setProfile]=useState<Profile|null>(null); const [isMaster,setIsMaster]=useState(false); const [companies,setCompanies]=useState<Company[]>([]);
  const [employees,setEmployees]=useState<Employee[]>([]); const [exams,setExams]=useState<Exam[]>([]); const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [functions,setFunctions]=useState<OccupationalFunction[]>([]); const [locations,setLocations]=useState<ExamLocation[]>([]); const [slots,setSlots]=useState<AvailabilitySlot[]>([]); const [locationCompanies,setLocationCompanies]=useState<LocationCompany[]>([]); const [locationSchedules,setLocationSchedules]=useState<LocationScheduleRule[]>([]); const [notifications,setNotifications]=useState<Notification[]>([]);
  const [employeeExamIds,setEmployeeExamIds]=useState<Record<string,string[]>>({});
  const [dialog,setDialog]=useState<"company"|"employee"|"exam"|"function"|"location"|"slot"|"appointment"|"join"|"agendaAccess"|null>(null); const [selectedCompany,setSelectedCompany]=useState<Company|null>(null); const [selectedEmployee,setSelectedEmployee]=useState<Employee|null>(null); const [selectedClinic,setSelectedClinic]=useState<(ExamLocation & {companies:LocationCompany[];schedule_rules:LocationScheduleRule[]})|null>(null); const [query,setQuery]=useState(""); const [notice,setNotice]=useState("");

  const loadClinics = useServerFn(loadClinicsForCurrentUser);

  async function load() {
    setLoading(true); const { data:userData }=await supabase.auth.getUser(); const user=userData.user; if(!user)return;
    let { data:p }=await supabase.from("profiles").select("id,company_id,full_name,preferred_language,is_active").eq("id",user.id).maybeSingle();
    if(!p){ await supabase.rpc("initialize_profile",{_full_name:String(user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "Usuário"),_language:language}); const result=await supabase.from("profiles").select("id,company_id,full_name,preferred_language,is_active").eq("id",user.id).single(); p=result.data; }
    if(p){setProfile(p); if(p.preferred_language==="pt"||p.preferred_language==="en")setLanguage(p.preferred_language);}
    if(p&&!p.is_active){setLoading(false);return;}
    const [{data:roles},{data:companyRows},{data:employeeRows},{data:examRows},{data:appointmentRows},{data:functionRows},{data:slotRows},{data:notificationRows},{data:employeeExamRows}]=await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id",user.id), supabase.from("companies").select("id,cnpj,legal_name,trade_name,status,street,number,complement,district,city,state,postal_code,registration_status,cnae_code,cnae_description,email,phone,created_at").order("created_at",{ascending:false}),
      supabase.from("employees").select("*").order("full_name"), supabase.from("exams").select("id,category,name_pt,name_en,duration_minutes,is_active").order("category").order("name_pt"),
      supabase.from("appointments").select("id,company_id,employee_id,assessment_type,job_title,starts_at,ends_at,location,location_id,notes,status,employees(full_name,cpf),appointment_exams(exams(name_pt,name_en))").order("starts_at"),
      supabase.from("occupational_functions").select("id,company_id,name,is_active,occupational_function_exams(exam_id)").order("name"),
      supabase.from("availability_slots").select("*,exam_locations(name)").order("starts_at"),
      supabase.from("notifications").select("id,appointment_id,is_read,created_at").order("created_at",{ascending:false}), supabase.from("employee_exams").select("employee_id,exam_id"),
    ]);
    const master=Boolean(roles?.some(r=>r.role==="master"));
    setIsMaster(master); setCompanies((companyRows??[]) as Company[]); setEmployees((employeeRows??[]) as Employee[]); setExams((examRows??[]) as Exam[]); setAppointments((appointmentRows??[]) as Appointment[]); setFunctions((functionRows??[]) as OccupationalFunction[]); setSlots((slotRows??[]) as AvailabilitySlot[]); setNotifications(notificationRows??[]); setEmployeeExamIds((employeeExamRows??[]).reduce<Record<string,string[]>>((all,row)=>({...all,[row.employee_id]:[...(all[row.employee_id]??[]),row.exam_id]}),{}));
    try {
      const clinicData = await loadClinics();
      const clinicRows = clinicData.locations ?? [];
      const clinicCompanyRows = clinicData.links ?? [];
      const clinicScheduleRows = clinicData.schedules ?? [];
      const clinicList = clinicRows.map((row) => ({
        ...(row as ExamLocation),
        companies: clinicCompanyRows.filter((link) => link.location_id === row.id) as LocationCompany[],
        schedule_rules: clinicScheduleRows.filter((rule) => rule.location_id === row.id) as LocationScheduleRule[],
      }));
      setLocations(clinicList);
      setLocationCompanies(clinicCompanyRows);
      setLocationSchedules(clinicScheduleRows);
    } catch (clinicLoadError) {
      console.error("[Clinic:load]", clinicLoadError);
      setNotice("Não foi possível carregar as clínicas e horários. Atualize a página.");
      setLocations([]);
      setLocationCompanies([]);
      setLocationSchedules([]);
    }
    setLoading(false);
  }
  useEffect(()=>{void load();},[]);
  async function signOut(){await supabase.auth.signOut();await navigate({to:"/auth",replace:true});}
  const filteredEmployees=employees.filter(e=>e.is_active&&`${e.full_name} ${e.cpf} ${e.job_title} ${e.workplace}`.toLowerCase().includes(query.toLowerCase()));
  const today=new Date().toISOString().slice(0,10); const todayCount=appointments.filter(a=>a.starts_at.slice(0,10)===today && a.status!=="cancelled").length;
  const weekCount=appointments.filter(a=>new Date(a.starts_at).getTime()>=Date.now()&&new Date(a.starts_at).getTime()<Date.now()+604800000&&a.status!=="cancelled").length;
  const labels=language==="pt"?{hello:"Olá",companiesDesc:"Cadastros e validações de CNPJ",employeesDesc:"Dados ocupacionais e vínculos",examsDesc:"Catálogo clínico e complementar",scheduleDesc:"Atendimentos e status",join:"Vincular empresa",noCompany:"Sua conta ainda não está vinculada a uma empresa.",review:"Revisar",all:"Todos",clinical:"Clínicos",complementary:"Complementares"}:{hello:"Hello",companiesDesc:"CNPJ registrations and reviews",employeesDesc:"Occupational data and employment",examsDesc:"Clinical and complementary catalog",scheduleDesc:"Appointments and statuses",join:"Join company",noCompany:"Your account is not linked to a company yet.",review:"Review",all:"All",clinical:"Clinical",complementary:"Complementary"};
  const nav=[{id:"dashboard",label:t("dashboard"),icon:LayoutDashboard},{id:"companies",label:t("companies"),icon:Building2},{id:"employees",label:t("employees"),icon:UsersRound},{id:"exams",label:t("exams"),icon:Stethoscope},{id:"locations",label:language==="pt"?"Locais e horários":"Locations and slots",icon:MapPin},{id:"schedule",label:t("schedule"),icon:CalendarDays},{id:"users",label:language==="pt"?"Usuários":"Users",icon:UserRound}] as const;

  if(!loading&&profile&&!profile.is_active)return <main className="grid min-h-screen place-items-center bg-background p-6"><section className="w-full max-w-lg rounded-md border bg-card p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-md bg-accent text-primary"><Clock3/></span><h1 className="mt-5 text-2xl font-semibold">{language==="pt"?"Acesso aguardando aprovação":"Access awaiting approval"}</h1><p className="mt-3 text-muted-foreground">{language==="pt"?"Seu cadastro foi recebido. O usuário mestre precisa liberar seu acesso antes da entrada no sistema.":"Your registration was received. The master user must approve your access before you can enter the system."}</p><Button className="mt-6" variant="outline" onClick={signOut}>{t("signOut")}</Button></section></main>;

  return <div className="min-h-screen bg-background text-foreground"><aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${mobile?"translate-x-0":"-translate-x-full"}`}>
    <div className="flex h-18 items-center justify-between border-b border-sidebar-border px-5"><button className="flex items-center gap-3" onClick={()=>setSection("dashboard")}><span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Activity className="size-5"/></span><span className="text-lg font-semibold">MedAgenda</span></button><Button variant="ghost" size="icon" className="lg:hidden" onClick={()=>setMobile(false)}><X/></Button></div>
    <nav className="space-y-1 p-3">{nav.filter(item=>isMaster||(item.id!=="companies"&&item.id!=="users"&&item.id!=="locations")).map(item=><Button key={item.id} variant={section===item.id?"secondary":"ghost"} className="w-full justify-start" onClick={()=>{setSection(item.id);setMobile(false)}}><item.icon/>{item.label}</Button>)}</nav>
    <div className="absolute inset-x-3 bottom-3 rounded-md border bg-background p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-accent"><UserRound className="size-4"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile?.full_name??"—"}</p><p className="text-xs text-muted-foreground">{isMaster?"Master":"Empresa"}</p></div></div><Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-muted-foreground" onClick={signOut}>{t("signOut")}</Button></div>
  </aside>{mobile&&<button className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" aria-label="Fechar menu" onClick={()=>setMobile(false)}/>}<div className="lg:pl-64">
    <header className="sticky top-0 z-20 flex h-18 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6"><Button variant="ghost" size="icon" className="lg:hidden" onClick={()=>setMobile(true)}><Menu/></Button><div className="flex-1"><p className="text-sm text-muted-foreground">MedAgenda Ocupacional</p><h1 className="font-semibold">{nav.find(n=>n.id===section)?.label}</h1></div><div className="flex rounded-md border p-0.5"><Button size="sm" variant={language==="pt"?"secondary":"ghost"} onClick={()=>setLanguage("pt")}>PT</Button><Button size="sm" variant={language==="en"?"secondary":"ghost"} onClick={()=>setLanguage("en")}>EN</Button></div></header>
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{notice&&<div className="mb-5 flex items-center justify-between rounded-md border border-primary/20 bg-accent p-3 text-sm"><span>{notice}</span><Button variant="ghost" size="icon" onClick={()=>setNotice("")}><X/></Button></div>}
      {loading?<Loading/>:section==="dashboard"?<><div className="mb-8"><h2 className="text-2xl font-semibold">{labels.hello}, {profile?.full_name.split(" ")[0]}.</h2><p className="mt-1 text-muted-foreground">{t("subtitle")}</p></div>{!isMaster&&!profile?.company_id&&<div className="mb-6 flex flex-col justify-between gap-4 border-l-4 border-highlight bg-card p-5 sm:flex-row sm:items-center"><div><p className="font-semibold">{labels.noCompany}</p><p className="text-sm text-muted-foreground">Use o código fornecido pelo administrador.</p></div><Button onClick={()=>setDialog("join")}>{labels.join}<ChevronRight/></Button></div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Clock3} label={t("today")} value={todayCount}/><Metric icon={CalendarDays} label={t("thisWeek")} value={weekCount}/><Metric icon={UsersRound} label={t("totalEmployees")} value={employees.filter(e=>e.is_active).length}/><Metric icon={Building2} label={t("pendingCompanies")} value={companies.filter(c=>c.status==="pending").length}/></div><div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]"><Panel title={t("upcoming")} action={<Button size="sm" onClick={()=>setDialog("appointment")}><Plus/>{t("newAppointment")}</Button>}><AppointmentList rows={appointments.slice(0,6)} language={language}/></Panel><Panel title={language==="pt"?"Ações rápidas":"Quick actions"}><div className="grid gap-3"><Quick icon={UsersRound} title={t("newEmployee")} onClick={()=>{setSelectedEmployee(null);setDialog("employee")}}/>{isMaster&&<Quick icon={Building2} title={t("newCompany")} onClick={()=>setDialog("company")}/>}<Quick icon={ClipboardPlus} title={t("newAppointment")} onClick={()=>setDialog("appointment")}/></div></Panel></div></>
      :section==="companies"?<Section title={t("companies")} subtitle={labels.companiesDesc} action={<Button onClick={()=>{setSelectedCompany(null);setDialog("company")}}><Plus/>{t("newCompany")}</Button>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.map(c=><div key={c.id} className="rounded-md border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{c.trade_name||c.legal_name}</p><p className="mt-1 text-xs text-muted-foreground">{formatCnpj(c.cnpj)}</p></div><Status status={c.status} t={t}/></div><p className="mt-5 text-sm text-muted-foreground">{c.city&&c.state?`${c.city} · ${c.state}`:"Localização não informada"}</p><p className="mt-2 text-xs text-muted-foreground">Receita Federal: {c.registration_status||"—"}</p><div className="mt-5 flex flex-wrap gap-2">{isMaster&&<Button size="sm" variant="outline" onClick={()=>{setSelectedCompany(c);setDialog("company")}}>Editar</Button>}{isMaster&&c.status==="approved"&&<Button size="sm" variant="outline" onClick={()=>{setSelectedCompany(c);setDialog("agendaAccess")}}>Criar acesso à agenda</Button>}{c.status==="pending"&&<><Button size="sm" onClick={()=>void reviewCompany(c.id,"approved")}><Check/>Aprovar</Button><Button size="sm" variant="outline" onClick={()=>void reviewCompany(c.id,"rejected")}>Rejeitar</Button></>}</div></div>)}</div></Section>
      :section==="employees"?<Section title={t("employees")} subtitle={labels.employeesDesc} action={<div className="flex gap-2">{isMaster&&<Button variant="outline" onClick={()=>setDialog("function")}><Plus/>{language==="pt"?"Nova função":"New function"}</Button>}<Button onClick={()=>{setSelectedEmployee(null);setDialog("employee")}} disabled={!isMaster&&!profile?.company_id}><Plus/>{t("newEmployee")}</Button></div>}><SearchBox value={query} setValue={setQuery} placeholder={`${t("search")}...`}/><div className="mt-4 overflow-x-auto rounded-md border bg-card"><div className="grid min-w-[900px] grid-cols-[1.35fr_1fr_1fr_1.2fr_1fr] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"><span>{language==="pt"?"Nome":"Name"}</span><span>CPF</span><span>{language==="pt"?"Função":"Job title"}</span><span>{language==="pt"?"Função ocupacional":"Occupational function"}</span><span>{language==="pt"?"Exames":"Exams"}</span></div>{filteredEmployees.map(e=>{const fn=functions.find(item=>item.id===e.occupational_function_id);const count=employeeExamIds[e.id]?.length??0;return <div key={e.id} className="grid min-w-[900px] grid-cols-[1.35fr_1fr_1fr_1.2fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-0"><b>{e.full_name}</b><span>{formatCpf(e.cpf)}</span><span>{e.job_title}</span><span>{fn?.name||"—"}</span><div className="flex items-center justify-between gap-2"><span>{count}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{setSelectedEmployee(e);setDialog("employee")}}>Editar</Button><Button size="sm" variant="destructive" onClick={()=>void deleteEmployee(e)}>Excluir</Button></div></div></div>})}{!filteredEmployees.length&&<Empty/>}</div><div className="mt-6"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">{language==="pt"?"Funções ocupacionais":"Occupational functions"}</h3><p className="text-sm text-muted-foreground">{language==="pt"?"Exames padrão associados a cada função.":"Default exams associated with each function."}</p></div></div>{functions.length?<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{functions.map(fn=>{const fnExams=(fn.occupational_function_exams??[]).map(link=>exams.find(exam=>exam.id===link.exam_id)).filter(Boolean) as Exam[];const company=companies.find(item=>item.id===fn.company_id);return <div key={fn.id} className="rounded-md border bg-card p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{fn.name}</p><p className="text-xs text-muted-foreground">{company?.trade_name||company?.legal_name||"—"}</p></div><Badge variant="outline">{fn.is_active?(language==="pt"?"Ativa":"Active"):(language==="pt"?"Inativa":"Inactive")}</Badge></div><div className="mt-3 flex flex-wrap gap-1.5">{fnExams.length?fnExams.map(exam=><Badge key={exam.id} variant="secondary">{language==="pt"?exam.name_pt:exam.name_en}</Badge>):<span className="text-xs text-muted-foreground">{language==="pt"?"Nenhum exame padrão":"No default exams"}</span>}</div></div>})}</div>:<div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">{language==="pt"?"Nenhuma função ocupacional cadastrada.":"No occupational functions registered."}</div>}</div></Section>
       :section==="exams"?<Section title={t("exams")} subtitle={labels.examsDesc} action={isMaster?<Button onClick={()=>setDialog("exam")}><Plus/>{t("newExam")}</Button>:undefined}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{exams.map(e=><div key={e.id} className="rounded-md border bg-card p-5"><div className="flex justify-between"><span className="grid size-9 place-items-center rounded-md bg-accent text-primary"><Stethoscope className="size-4"/></span><Badge variant="outline">{e.category==="clinical"?labels.clinical:labels.complementary}</Badge></div><h3 className="mt-5 font-semibold">{language==="pt"?e.name_pt:e.name_en}</h3><p className="mt-2 text-sm text-muted-foreground">{e.duration_minutes} min · {e.is_active?t("active"):t("inactive")}</p></div>)}</div></Section>
       :section==="locations"?<Section title={language==="pt"?"Locais e horários":"Locations and slots"} subtitle={language==="pt"?"Clínicas, empresas habilitadas e agenda de atendimento":"Clinics, enabled companies and service schedules"} action={isMaster?<Button onClick={()=>setDialog("location")}><Plus/>{language==="pt"?"Nova clínica":"New clinic"}</Button>:undefined}><div className="grid gap-4 lg:grid-cols-2">{locations.map(location=>{const linked=locationCompanies.filter(x=>x.location_id===location.id).map(x=>companies.find(c=>c.id===x.company_id)).filter(Boolean) as Company[];const rules=locationSchedules.filter(x=>x.location_id===location.id&&x.is_active);return <div key={location.id} className="rounded-md border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{location.name}</p><p className="mt-1 text-sm text-muted-foreground">{[location.street,location.number,location.complement].filter(Boolean).join(", ")}</p><p className="text-sm text-muted-foreground">{[location.district,location.city,location.state,location.postal_code].filter(Boolean).join(" · ")}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{location.is_active?(language==="pt"?"Ativa":"Active"):(language==="pt"?"Inativa":"Inactive")}</Badge>{isMaster&&<Button size="sm" variant="outline" onClick={()=>{setSelectedClinic(location);setDialog("location")}}>Editar</Button>}{isMaster&&<Button size="sm" variant="outline" onClick={async()=>{if(!window.confirm(language==="pt"?"Excluir esta clínica? O cadastro será mantido apenas para histórico.":"Delete this clinic? The record will be kept only for history."))return;try{const {error}=await supabase.rpc("deactivate_exam_location",{p_location_id:location.id});if(error)throw error;setNotice(language==="pt"?"Clínica excluída.":"Clinic deleted.");await load();}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível excluir a clínica.");}}}>Excluir</Button>}</div></div><div className="mt-5"><p className="text-xs font-semibold uppercase text-muted-foreground">{language==="pt"?"Empresas":"Companies"}</p><div className="mt-2 flex flex-wrap gap-2">{linked.length?linked.map(c=><Badge key={c.id} variant="secondary">{c.trade_name||c.legal_name}</Badge>):<span className="text-sm text-muted-foreground">{language==="pt"?"Sem empresa vinculada":"No company linked"}</span>}</div></div><div className="mt-5"><p className="text-xs font-semibold uppercase text-muted-foreground">{language==="pt"?"Agenda semanal":"Weekly schedule"}</p><div className="mt-2 space-y-1">{rules.length?rules.map(rule=><p key={rule.id} className="text-sm">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][rule.weekday]} · {String(rule.start_time).slice(0,5)}–{String(rule.end_time).slice(0,5)} · {rule.slot_minutes} min</p>):<span className="text-sm text-muted-foreground">{language==="pt"?"Sem agenda configurada":"No schedule configured"}</span>}</div></div></div>})}{!locations.length&&<div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground lg:col-span-2">{language==="pt"?"Nenhuma clínica cadastrada.":"No clinics registered."}</div>}</div></Section> :section==="users"&&isMaster?<UserManagement language={language}/>
       :<Section title={t("schedule")} subtitle={labels.scheduleDesc} action={<Button onClick={()=>setDialog("appointment")} disabled={!employees.length}><Plus/>{t("newAppointment")}</Button>}><div className="mb-5 flex gap-2"><Button size="sm">{language==="pt"?"Lista":"List"}</Button><Button size="sm" variant="outline">{language==="pt"?"Semana":"Week"}</Button></div><div className="overflow-hidden rounded-md border bg-card"><AppointmentList rows={appointments} language={language}/>{!appointments.length&&<Empty/>}</div></Section>}
    </main></div>
    <CompanyDialog open={dialog==="company"} company={selectedCompany} onClose={()=>{setDialog(null);setSelectedCompany(null)}} language={language} onSaved={async()=>{setDialog(null);setSelectedCompany(null);setNotice(selectedCompany?"Empresa atualizada com sucesso.":"Empresa enviada para revisão.");await load()}}/>
    <EmployeeDialog open={dialog==="employee"} employee={selectedEmployee} employeeExamIds={employeeExamIds} onClose={()=>{setDialog(null);setSelectedEmployee(null)}} language={language} functions={functions} exams={exams} companies={companies} isMaster={isMaster} companyId={profile?.company_id??companies.find(c=>c.status==="approved")?.id??null} onSaved={async()=>{const wasEditing=Boolean(selectedEmployee);setDialog(null);setSelectedEmployee(null);setNotice(wasEditing?"Funcionário atualizado com sucesso.":"Funcionário cadastrado com sucesso.");await load()}}/>
    <FunctionDialog open={dialog==="function"} onClose={()=>setDialog(null)} language={language} exams={exams} companyId={profile?.company_id??companies.find(c=>c.status==="approved")?.id??null} onSaved={async()=>{setDialog(null);setNotice(language==="pt"?"Função cadastrada.":"Function registered.");await load()}}/>
    <ClinicDialog open={dialog==="location"} clinic={selectedClinic} onClose={()=>{setDialog(null);setSelectedClinic(null)}} language={language} companies={companies} onSaved={async()=>{setDialog(null);setSelectedClinic(null);setNotice(selectedClinic?(language==="pt"?"Clínica atualizada e agenda regenerada.":"Clinic updated and schedule regenerated."):(language==="pt"?"Clínica cadastrada e agenda gerada.":"Clinic registered and schedule generated."));await load()}}/>
    <ExamDialog open={dialog==="exam"} onClose={()=>setDialog(null)} onSaved={async()=>{setDialog(null);setNotice("Exame adicionado ao catálogo.");await load()}}/>
    <AppointmentDialog open={dialog==="appointment"} onClose={()=>setDialog(null)} employees={employees} exams={exams} profile={profile} companies={companies} functions={functions} locations={locations} locationSchedules={locationSchedules} employeeExamIds={employeeExamIds} isMaster={isMaster} onSaved={async()=>{setDialog(null);setNotice("Agendamento criado.");await load()}}/>
    <JoinDialog open={dialog==="join"} onClose={()=>setDialog(null)} onSaved={async()=>{setDialog(null);setNotice("Empresa vinculada com sucesso.");await load()}}/>
    <AgendaAccessDialog open={dialog==="agendaAccess"} company={selectedCompany} language={language} onClose={()=>{setDialog(null);setSelectedCompany(null)}} onSaved={(code)=>{setDialog(null);setSelectedCompany(null);setNotice(`Acesso criado. Código de login: ${code}`)}}/>
  </div>;

  async function reviewCompany(id:string,status:"approved"|"rejected"){const {data:user}=await supabase.auth.getUser();const {error}=await supabase.from("companies").update({status,reviewed_by:user.user?.id??null,reviewed_at:new Date().toISOString(),rejection_reason:status==="rejected"?"Cadastro requer ajustes":null}).eq("id",id);if(error){setNotice(error.message);return;}if(status==="approved"){const code=`EMP-${crypto.randomUUID().slice(0,8).toUpperCase()}`;const {error:codeError}=await supabase.rpc("create_company_access_code",{_company_id:id,_plain_code:code,_label:"Acesso principal"});setNotice(codeError?"Empresa aprovada, mas não foi possível gerar o código.":`Empresa aprovada. Código de acesso: ${code}`);}else setNotice("Empresa rejeitada.");await load();}
  async function deleteEmployee(employee:Employee){
    const confirmed=window.confirm(language==="pt"?"Excluir o funcionário "+employee.full_name+"? O cadastro será mantido no histórico e ficará inativo.":"Delete employee "+employee.full_name+"? The record will be kept for history and marked inactive.");
    if(!confirmed)return;
    const {error}=await supabase.from("employees").update({is_active:false}).eq("id",employee.id);
    if(error){setNotice(language==="pt"?"Não foi possível excluir o funcionário: "+error.message:"Could not delete employee: "+error.message);return;}
    setNotice(language==="pt"?"Funcionário excluído com sucesso.":"Employee deleted successfully.");
    await load();
  }
}

function Metric({icon:Icon,label,value}:{icon:typeof Clock3;label:string;value:number}){return <div className="rounded-md border bg-card p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="size-5 text-primary"/></div><p className="mt-3 text-3xl font-semibold">{value}</p></div>}
function Panel({title,action,children}:{title:string;action?:ReactNode;children:ReactNode}){return <section className="rounded-md border bg-card"><header className="flex items-center justify-between border-b p-5"><h3 className="font-semibold">{title}</h3>{action}</header><div className="p-5">{children}</div></section>}
function Section({title,subtitle,action,children}:{title:string;subtitle:string;action?:ReactNode;children:ReactNode}){return <><header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-muted-foreground">{subtitle}</p></div>{action}</header>{children}</>}
function Quick({icon:Icon,title,onClick}:{icon:typeof UsersRound;title:string;onClick:()=>void}){return <Button variant="outline" className="h-auto justify-between p-4" onClick={onClick}><span className="flex items-center gap-3"><Icon className="text-primary"/>{title}</span><ChevronRight/></Button>}
function SearchBox({value,setValue,placeholder}:{value:string;setValue:(v:string)=>void;placeholder:string}){return <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input className="pl-9" value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder}/></div>}
function Empty(){return <div className="p-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>}
function Loading(){return <div className="grid min-h-[50vh] place-items-center"><Activity className="size-8 animate-pulse text-primary"/></div>}
function Status({status,t}:{status:Company["status"];t:(k:any)=>string}){const tone=status==="approved"?"bg-success/15 text-success":status==="rejected"?"bg-destructive/10 text-destructive":"bg-warning/15 text-warning";return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{t(status as any)}</span>}
function AppointmentList({rows,language}:{rows:Appointment[];language:"pt"|"en"}){return <div className="divide-y">{rows.map(a=><div key={a.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"><div className="w-14 text-center"><b className="block text-sm">{new Date(a.starts_at).toLocaleTimeString(language==="pt"?"pt-BR":"en",{hour:"2-digit",minute:"2-digit"})}</b><small className="text-muted-foreground">{new Date(a.starts_at).toLocaleDateString(language==="pt"?"pt-BR":"en",{day:"2-digit",month:"short"})}</small></div><div className="min-w-0 flex-1"><p className="truncate font-medium">{a.employees?.full_name??(language==="pt"?"Funcionário":"Employee")}</p><p className="truncate text-sm text-muted-foreground">{[a.job_title,a.location].filter(Boolean).join(" · ")}</p></div><Badge variant="outline">{a.status}</Badge></div>)}</div>}
function DialogFrame({open,onClose,title,description,children,onSubmit}:{open:boolean;onClose:()=>void;title:string;description:string;children:ReactNode;onSubmit:(e:FormEvent<HTMLFormElement>)=>void}){return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="space-y-5">{children}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></DialogFooter></form></DialogContent></Dialog>}
function Field({label,name,type="text",required=true,defaultValue,minLength,maxLength=160}:{label:string;name:string;type?:string;required?:boolean;defaultValue?:string;minLength?:number;maxLength?:number}){return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} {...(minLength===undefined?{}:{minLength})} {...(maxLength===undefined?{}:{maxLength})}/></div>}

function CompanyDialog({open,onClose,onSaved,language,company}:{open:boolean;onClose:()=>void;onSaved:()=>void;language:"pt"|"en";company:Company|null}){
  type CnpjResult={cnpj:string;legal_name:string;trade_name:string;registration_status:string;cnae_code:string;cnae_description:string;email:string;phone:string;street:string;number:string;complement:string;district:string;city:string;state:string;postal_code:string};
  const runLookup=useServerFn(lookupCnpj); const [cnpj,setCnpj]=useState(""); const [found,setFound]=useState<CnpjResult|null>(null); const [error,setError]=useState(""); const [checking,setChecking]=useState(false);
  useEffect(()=>{if(open){setError("");setCnpj(company?.cnpj??"");setFound(company?{cnpj:company.cnpj,legal_name:company.legal_name,trade_name:company.trade_name??"",registration_status:company.registration_status??"",cnae_code:company.cnae_code??"",cnae_description:company.cnae_description??"",email:company.email??"",phone:company.phone??"",street:company.street??"",number:company.number??"",complement:company.complement??"",district:company.district??"",city:company.city??"",state:company.state??"",postal_code:company.postal_code??""}:null);}},[open,company]);
  async function check(){const digits=cnpj.replace(/\D/g,"");if(digits.length!==14){setError(language==="pt"?"Informe os 14 dígitos do CNPJ.":"Enter all 14 CNPJ digits.");return;}setChecking(true);setError("");try{const result=await runLookup({data:{cnpj:digits}});if(!result.ok){setError(result.message);return;}setFound(result.company);}catch{setError(language==="pt"?"A consulta está temporariamente indisponível. Tente novamente.":"The lookup is temporarily unavailable. Please try again.");}finally{setChecking(false);}}
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!found){setError(language==="pt"?"Consulte o CNPJ antes de salvar.":"Look up the CNPJ before saving.");return;}const f=new FormData(e.currentTarget);const values={legal_name:String(f.get("legal_name")).trim(),trade_name:String(f.get("trade_name")).trim()||null,registration_status:String(f.get("registration_status")).trim()||null,cnae_code:String(f.get("cnae_code")).trim()||null,cnae_description:String(f.get("cnae_description")).trim()||null,email:String(f.get("email")).trim()||null,phone:String(f.get("phone")).trim()||null,street:String(f.get("street")).trim()||null,number:String(f.get("number")).trim()||null,complement:String(f.get("complement")).trim()||null,district:String(f.get("district")).trim()||null,city:String(f.get("city")).trim()||null,state:String(f.get("state")).trim().toUpperCase()||null,postal_code:String(f.get("postal_code")).replace(/\D/g,"")||null};if(values.legal_name.length<2){setError(language==="pt"?"Informe a razão social.":"Enter the legal name.");return;}if(company){const {error:saveError}=await supabase.from("companies").update(values).eq("id",company.id);if(saveError)setError(saveError.message);else onSaved();return;}const {data:user}=await supabase.auth.getUser();if(!user.user)return;const {error:saveError}=await supabase.from("companies").insert({...values,cnpj:found.cnpj,status:"pending",created_by:user.user.id});if(saveError)setError(saveError.message);else onSaved();}
  return <DialogFrame open={open} onClose={onClose} onSubmit={submit} title={company?(language==="pt"?"Editar empresa":"Edit company"):(language==="pt"?"Cadastrar empresa":"Register company")} description={company?(language==="pt"?"Atualize os dados cadastrais da empresa.":"Update the company's registration data."):(language==="pt"?"Consulte o CNPJ, confira os dados encontrados e salve.":"Look up the CNPJ, review the returned data, and save.")}>
    <div className="flex gap-2"><div className="flex-1 space-y-2"><Label htmlFor="company-cnpj">CNPJ</Label><Input id="company-cnpj" name="cnpj_lookup" inputMode="numeric" value={cnpj} onChange={event=>{setCnpj(event.target.value);if(!company)setFound(null)}} maxLength={18} required disabled={Boolean(company)}/></div>{!company&&<Button type="button" variant="outline" className="mt-8" onClick={()=>void check()} disabled={checking}>{checking?(language==="pt"?"Consultando...":"Looking up..."):(language==="pt"?"Consultar":"Look up")}</Button>}</div>
    {error&&<p className="text-sm text-destructive">{error}</p>}{found&&<div key={found.cnpj} className="grid gap-4 border-t pt-5 sm:grid-cols-2"><Field label={language==="pt"?"Razão social":"Legal name"} name="legal_name" defaultValue={found.legal_name}/><Field label={language==="pt"?"Nome fantasia":"Trade name"} name="trade_name" required={false} defaultValue={found.trade_name}/><Field label={language==="pt"?"Situação cadastral":"Registration status"} name="registration_status" required={false} defaultValue={found.registration_status}/><Field label="CNAE" name="cnae_code" required={false} defaultValue={found.cnae_code}/><div className="sm:col-span-2"><Field label={language==="pt"?"Descrição do CNAE":"CNAE description"} name="cnae_description" required={false} defaultValue={found.cnae_description}/></div><Field label="E-mail" name="email" type="email" required={false} defaultValue={found.email}/><Field label={language==="pt"?"Telefone":"Phone"} name="phone" required={false} defaultValue={found.phone}/><Field label={language==="pt"?"Logradouro":"Street"} name="street" required={false} defaultValue={found.street}/><Field label={language==="pt"?"Número":"Number"} name="number" required={false} defaultValue={found.number}/><Field label={language==="pt"?"Complemento":"Address details"} name="complement" required={false} defaultValue={found.complement}/><Field label={language==="pt"?"Bairro":"District"} name="district" required={false} defaultValue={found.district}/><Field label={language==="pt"?"Cidade":"City"} name="city" required={false} defaultValue={found.city}/><Field label="UF" name="state" required={false} defaultValue={found.state}/><Field label="CEP" name="postal_code" required={false} defaultValue={found.postal_code}/></div>}
  </DialogFrame>;
}
function AgendaAccessDialog({open,onClose,onSaved,company,language}:{open:boolean;onClose:()=>void;onSaved:(code:string)=>void;company:Company|null;language:"pt"|"en"}){
  const createAccess=useServerFn(createCompanyAgendaUser); const [error,setError]=useState(""); const [loginCode,setLoginCode]=useState(""); const [created,setCreated]=useState(false);
  useEffect(()=>{if(open){setError("");setLoginCode("");setCreated(false);}},[open]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!company){setError("Empresa não selecionada.");return;}const f=new FormData(e.currentTarget);try{const result=await createAccess({data:{companyId:company.id,fullName:String(f.get("full_name")).trim(),password:String(f.get("password"))}});setLoginCode(result.loginCode);setCreated(true);}catch(error){setError(error instanceof Error?error.message:"Não foi possível criar o acesso.");}}
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{language==="pt"?"Acesso à agenda":"Agenda access"}</DialogTitle><DialogDescription>{company?.trade_name||company?.legal_name} · {language==="pt"?"Crie o usuário e a senha de acesso.":"Create the user's login and password."}</DialogDescription></DialogHeader>{created?<div className="space-y-4"><p className="text-sm">Código de login:</p><div className="rounded-md border bg-muted p-4 text-center font-mono text-lg">{loginCode}</div><p className="text-sm text-muted-foreground">{language==="pt"?"Entregue este código e a senha cadastrada ao usuário. O código também pode ser usado na tela de login.":"Give this code and the configured password to the user."}</p><DialogFooter><Button onClick={onClose}>Concluir</Button></DialogFooter></div>:<form onSubmit={submit} className="space-y-5"><Field label={language==="pt"?"Nome do usuário":"User name"} name="full_name"/><Field label={language==="pt"?"Senha inicial":"Initial password"} name="password" type="password" minLength={8} maxLength={72}/>{error&&<p className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Criar acesso</Button></DialogFooter></form>}</DialogContent></Dialog>;
}
function EmployeeDialog({open,onClose,onSaved,employee,employeeExamIds,companyId,language,functions,exams,companies,isMaster}:{open:boolean;onClose:()=>void;onSaved:()=>void;employee:Employee|null;employeeExamIds:Record<string,string[]>;companyId:string|null;language:"pt"|"en";functions:OccupationalFunction[];exams:Exam[];companies:Company[];isMaster:boolean}) {
  const editing=Boolean(employee);
  const [error,setError]=useState("");
  const [functionId,setFunctionId]=useState("");
  const [selectedExamIds,setSelectedExamIds]=useState<string[]>([]);
  const [selectedCompanyId,setSelectedCompanyId]=useState(companyId??"");
  const selectedFunction=functions.find(item=>item.id===functionId);
  useEffect(()=>{
    if(!open)return;
    setError("");
    setSelectedCompanyId(employee?.company_id??companyId??"");
    setFunctionId(employee?.occupational_function_id??"");
    setSelectedExamIds(employee?employeeExamIds[employee.id]??[]:[]);
  },[open,employee,companyId,employeeExamIds]);
  useEffect(()=>{
    if(!open||editing||!selectedFunction)return;
    setSelectedExamIds(selectedFunction.occupational_function_exams?.map(x=>x.exam_id)??[]);
  },[functionId,open,editing,selectedFunction]);
  function toggleExam(id:string){setSelectedExamIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);}
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setError("");
    const effectiveCompanyId=selectedCompanyId||companyId;
    if(!effectiveCompanyId){setError("Selecione ou vincule uma empresa aprovada.");return;}
    const f=new FormData(e.currentTarget);
    const cpf=String(f.get("cpf")??"").replace(/\D/g,"");
    if(cpf.length!==11){setError(language==="pt"?"Informe os 11 dígitos do CPF.":"Enter all 11 CPF digits.");return;}
    const {data:user}=await supabase.auth.getUser();
    if(!user.user){setError("Sessão expirada.");return;}
    const row: Database["public"]["Tables"]["employees"]["Update"]={
      company_id:effectiveCompanyId,
      full_name:String(f.get("full_name")??"").trim(),
      cpf,
      rg:String(f.get("rg")??"").trim()||null,
      birthplace:String(f.get("birthplace")??"").trim(),
      nationality:String(f.get("nationality")??"").trim(),
      birth_date:String(f.get("birth_date")??""),
      sex:String(f.get("sex")??""),
      job_title:String(f.get("job_title")??"").trim(),
      occupational_function_id:functionId||null,
      admission_date:String(f.get("admission_date")??"").trim()||null,
      workplace:String(f.get("workplace")??"").trim(),
    };
    if(row.full_name.length<2||!row.birthplace||!row.nationality||!row.birth_date||!row.job_title||!row.workplace){
      setError(language==="pt"?"Preencha todos os dados obrigatórios do funcionário.":"Fill in all required employee fields.");
      return;
    }
    if(editing&&employee){
      const {error:saveError}=await supabase.from("employees").update(row).eq("id",employee.id);
      if(saveError){setError(saveError.message);return;}
      const previous=new Set(employeeExamIds[employee.id]??[]);
      const selected=new Set(selectedExamIds);
      const toAdd=selectedExamIds.filter(id=>!previous.has(id));
      const toRemove=[...(previous)].filter(id=>!selected.has(id));
      if(toAdd.length){
        const {error:addError}=await supabase.from("employee_exams").insert(toAdd.map(exam_id=>({employee_id:employee.id,exam_id})));
        if(addError){setError(addError.message);return;}
      }
      if(toRemove.length){
        const {error:removeError}=await supabase.from("employee_exams").delete().eq("employee_id",employee.id).in("exam_id",toRemove);
        if(removeError){setError(removeError.message);return;}
      }
      onSaved();
      return;
    }
    const {data:created,error:saveError}=await supabase.from("employees").insert({...row,created_by:user.user.id}).select("id").single();
    if(saveError||!created){setError(saveError?.message??"Não foi possível cadastrar o funcionário.");return;}
    if(selectedExamIds.length){
      const {error:examError}=await supabase.from("employee_exams").insert(selectedExamIds.map(exam_id=>({employee_id:created.id,exam_id})));
      if(examError){
        await supabase.from("employees").delete().eq("id",created.id);
        setError(examError.message);
        return;
      }
    }
    onSaved();
  }
  return <DialogFrame open={open} onClose={onClose} onSubmit={submit} title={editing?(language==="pt"?"Editar funcionário":"Edit employee"):(language==="pt"?"Novo funcionário":"New employee")} description={editing?(language==="pt"?"Atualize os dados cadastrais, função e exames do funcionário.":"Update the employee's registration data, function and exams."):(language==="pt"?"Dados pessoais, função ocupacional e exames autorizados.":"Personal data, occupational function and authorized exams.")}>
    <div className="space-y-2 sm:col-span-2"><Label>Empresa</Label><Select value={selectedCompanyId} onValueChange={value=>{setSelectedCompanyId(value);setFunctionId("");if(!editing)setSelectedExamIds([]);}} disabled={!isMaster||editing}><SelectTrigger><SelectValue placeholder="Selecionar empresa"/></SelectTrigger><SelectContent>{companies.filter(item=>item.status==="approved").map(item=><SelectItem key={item.id} value={item.id}>{item.trade_name||item.legal_name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-4 sm:grid-cols-2">
      <Field label={language==="pt"?"Nome completo":"Full name"} name="full_name" defaultValue={employee?.full_name??""}/><Field label="CPF" name="cpf" defaultValue={employee?formatCpf(employee.cpf):""}/><Field label="RG" name="rg" required={false} defaultValue={employee?.rg??""}/>
      <Field label={language==="pt"?"Naturalidade":"Birthplace"} name="birthplace" defaultValue={employee?.birthplace??""}/><Field label={language==="pt"?"Nacionalidade":"Nationality"} name="nationality" defaultValue={employee?.nationality??""}/><Field label={language==="pt"?"Data de nascimento":"Date of birth"} name="birth_date" type="date" defaultValue={employee?.birth_date??""}/>
      <div className="space-y-2"><Label>{language==="pt"?"Sexo":"Sex"}</Label><Select key={employee?.id??"new"} name="sex" defaultValue={employee?.sex??"not_informed"}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="female">{language==="pt"?"Feminino":"Female"}</SelectItem><SelectItem value="male">{language==="pt"?"Masculino":"Male"}</SelectItem><SelectItem value="other">{language==="pt"?"Outro":"Other"}</SelectItem><SelectItem value="not_informed">{language==="pt"?"Não informado":"Not informed"}</SelectItem></SelectContent></Select></div>
      <Field label={language==="pt"?"Função":"Job title"} name="job_title" defaultValue={employee?.job_title??""}/><Field label={language==="pt"?"Data de admissão (opcional)":"Admission date (optional)"} name="admission_date" type="date" required={false} defaultValue={employee?.admission_date??""}/><Field label={language==="pt"?"Posto de trabalho":"Workplace"} name="workplace" defaultValue={employee?.workplace??""}/>
      <div className="space-y-2"><Label>{language==="pt"?"Função ocupacional":"Occupational function"}</Label><Select value={functionId} onValueChange={setFunctionId}><SelectTrigger><SelectValue placeholder={language==="pt"?"Selecionar função":"Select function"}/></SelectTrigger><SelectContent>{functions.filter(x=>x.is_active&&x.company_id===selectedCompanyId).map(item=><SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="mt-5 space-y-3 border-t pt-5"><div><p className="font-semibold">{language==="pt"?"Exames autorizados para este funcionário":"Exams authorized for this employee"}</p><p className="text-sm text-muted-foreground">{language==="pt"?"Na edição, marque ou desmarque os exames conforme necessário.":"When editing, check or uncheck exams as needed."}</p></div>
      <div className="grid gap-2 sm:grid-cols-2">{exams.filter(x=>x.is_active).map(exam=><label key={exam.id} className="flex items-center gap-3 rounded-md border p-3"><Checkbox checked={selectedExamIds.includes(exam.id)} onCheckedChange={()=>toggleExam(exam.id)}/><span className="text-sm">{language==="pt"?exam.name_pt:exam.name_en}</span></label>)}</div>
    </div>
    {error&&<p className="text-sm text-destructive">{error}</p>}
  </DialogFrame>
}
function FunctionDialog({open,onClose,onSaved,companyId,exams,language}:{open:boolean;onClose:()=>void;onSaved:()=>void;companyId:string|null;exams:Exam[];language:"pt"|"en"}) {
  const [error,setError]=useState(""); const [selectedExamIds,setSelectedExamIds]=useState<string[]>([]);
  useEffect(()=>{if(open){setError("");setSelectedExamIds([]);}},[open]);
  function toggleExam(id:string){setSelectedExamIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);}
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!companyId){setError("Selecione ou vincule uma empresa aprovada.");return;}const f=new FormData(e.currentTarget);const name=String(f.get("name")).trim();if(name.length<2){setError(language==="pt"?"Informe o nome da função.":"Enter the function name.");return;}const {data:user}=await supabase.auth.getUser();if(!user.user){setError("Sessão expirada.");return;}const {data:created,error:saveError}=await supabase.from("occupational_functions").insert({company_id:companyId,name,is_active:true,created_by:user.user.id}).select("id").single();if(saveError||!created){setError(saveError?.message??"Não foi possível cadastrar a função.");return;}if(selectedExamIds.length){const {error:examError}=await supabase.from("occupational_function_exams").insert(selectedExamIds.map(exam_id=>({function_id:created.id,exam_id})));if(examError){setError(examError.message);return;}}onSaved();}
  return <DialogFrame open={open} onClose={onClose} onSubmit={submit} title={language==="pt"?"Nova função ocupacional":"New occupational function"} description={language==="pt"?"Cadastre a função e os exames padrão associados.":"Register the function and its default associated exams."}><Field label={language==="pt"?"Nome da função":"Function name"} name="name"/><div className="mt-5 space-y-3 border-t pt-5"><p className="font-semibold">{language==="pt"?"Exames padrão da função":"Function default exams"}</p><div className="grid gap-2 sm:grid-cols-2">{exams.filter(x=>x.is_active).map(exam=><label key={exam.id} className="flex items-center gap-3 rounded-md border p-3"><Checkbox checked={selectedExamIds.includes(exam.id)} onCheckedChange={()=>toggleExam(exam.id)}/><span className="text-sm">{language==="pt"?exam.name_pt:exam.name_en}</span></label>)}</div></div>{error&&<p className="mt-4 text-sm text-destructive">{error}</p>}</DialogFrame>
}
function ExamDialog({open,onClose,onSaved}:{open:boolean;onClose:()=>void;onSaved:()=>void}){const [error,setError]=useState("");async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const {data:user}=await supabase.auth.getUser();const {error:saveError}=await supabase.from("exams").insert({category:String(f.get("category")) as "clinical"|"complementary",name_pt:String(f.get("name_pt")),name_en:String(f.get("name_en")),duration_minutes:Number(f.get("duration")),created_by:user.user?.id??null});if(saveError)setError(saveError.message);else onSaved();}return <DialogFrame open={open} onClose={onClose} onSubmit={submit} title="Novo exame" description="Adicione o nome nos dois idiomas."><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Categoria</Label><Select name="category" defaultValue="complementary"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="clinical">Clínico</SelectItem><SelectItem value="complementary">Complementar</SelectItem></SelectContent></Select></div><Field label="Duração (min)" name="duration" type="number" defaultValue="30"/><Field label="Nome em português" name="name_pt"/><Field label="Nome em inglês" name="name_en"/></div>{error&&<p className="text-sm text-destructive">{error}</p>}</DialogFrame>}
function ClinicDialog({open,onClose,onSaved,companies,language,clinic}:{open:boolean;onClose:()=>void;onSaved:()=>void;companies:Company[];language:"pt"|"en";clinic:(ExamLocation & {companies:LocationCompany[];schedule_rules:LocationScheduleRule[]})|null}) {
  const days=useMemo(()=>language==="pt"?["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"]:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],[language]);
  const [error,setError]=useState("");
  const runSaveClinic=useServerFn(saveClinicFromMaster);
  const [selectedCompanies,setSelectedCompanies]=useState<string[]>([]);
  const [schedule,setSchedule]=useState(days.map((_,weekday)=>({weekday,enabled:weekday>=1&&weekday<=5,start_time:"08:00",end_time:"17:00",slot_minutes:30})));
  useEffect(()=>{if(open){setError("");setSelectedCompanies(clinic?.companies?.map(x=>x.company_id)??[]);const rules=clinic?.schedule_rules??[];setSchedule(days.map((_,weekday)=>{const rule=rules.find(x=>x.weekday===weekday);return {weekday,enabled:Boolean(rule),start_time:String(rule?.start_time??"08:00").slice(0,5),end_time:String(rule?.end_time??"17:00").slice(0,5),slot_minutes:Number(rule?.slot_minutes??30)}}));}},[open,language,clinic,days]);
  function toggleCompany(id:string){setSelectedCompanies(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);}
  function updateDay(weekday:number,key:"enabled"|"start_time"|"end_time"|"slot_minutes",value:boolean|string|number){setSchedule(current=>current.map(day=>day.weekday===weekday?{...day,[key]:value}:day));}
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); setError("");
    if(!selectedCompanies.length){setError(language==="pt"?"Selecione pelo menos uma empresa aprovada.":"Select at least one approved company.");return;}
    const active=schedule.filter(day=>day.enabled);
    if(!active.length){setError(language==="pt"?"Configure pelo menos um dia de atendimento.":"Configure at least one service day.");return;}
    const f=new FormData(e.currentTarget);
    const data={
      name:String(f.get("name")).trim(),street:String(f.get("street")).trim(),number:String(f.get("number")).trim(),
      complement:String(f.get("complement")).trim(),district:String(f.get("district")).trim(),city:String(f.get("city")).trim(),
      state:String(f.get("state")).trim().toUpperCase(),postal_code:String(f.get("postal_code")).replace(/\\D/g,""),phone:String(f.get("phone")).trim(),
      company_ids:selectedCompanies,schedule:active.map(day=>({weekday:day.weekday,start_time:day.start_time,end_time:day.end_time,slot_minutes:Number(day.slot_minutes)}))
    };
    try {
      const { data: sessionData, error:sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Sessão expirada. Entre novamente no sistema.");
      }
      const { locationId } = await runSaveClinic({
        data: {
          locationId: clinic?.id ?? null,
          clinic: {
            name: data.name,
            street: data.street,
            number: data.number || null,
            complement: data.complement || null,
            district: data.district || null,
            city: data.city,
            state: data.state,
            postal_code: data.postal_code || null,
            phone: data.phone || null,
            company_ids: data.company_ids,
            schedule: data.schedule,
          },
        },
      });
      if (!locationId) throw new Error("O banco não retornou o ID da clínica salva.");
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível cadastrar a clínica.");
    }
  }
  const approved=companies.filter(c=>c.status==="approved");
  return <DialogFrame open={open} onClose={onClose} onSubmit={submit} title={clinic?(language==="pt"?"Editar clínica de atendimento":"Edit service clinic"):(language==="pt"?"Cadastrar clínica de atendimento":"Register service clinic")} description={clinic?(language==="pt"?"Atualize endereço, empresas habilitadas e agenda semanal.":"Update the address, enabled companies and weekly schedule."):(language==="pt"?"Cadastre endereço, empresas habilitadas e agenda semanal. Os horários serão gerados automaticamente.":"Register the address, enabled companies and weekly schedule.")}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label={language==="pt"?"Nome da clínica":"Clinic name"} name="name" defaultValue={clinic?.name ?? ""}/></div>
      <Field label={language==="pt"?"Logradouro":"Street"} name="street" defaultValue={clinic?.street ?? ""}/>
      <Field label={language==="pt"?"Número":"Number"} name="number" required={false} defaultValue={clinic?.number??""}/>
      <Field label={language==="pt"?"Complemento":"Address details"} name="complement" required={false} defaultValue={clinic?.complement??""}/>
      <Field label={language==="pt"?"Bairro":"District"} name="district" required={false} defaultValue={clinic?.district??""}/>
      <Field label={language==="pt"?"Cidade":"City"} name="city" defaultValue={clinic?.city ?? ""}/>
      <Field label="UF" name="state" defaultValue={clinic?.state ?? ""}/>
      <Field label="CEP" name="postal_code" required={false} defaultValue={clinic?.postal_code??""}/>
      <Field label={language==="pt"?"Telefone":"Phone"} name="phone" required={false} defaultValue={clinic?.phone??""}/>
    </div>
    <div className="space-y-3 border-t pt-5">
      <div><p className="font-semibold">{language==="pt"?"Empresas habilitadas":"Enabled companies"}</p><p className="text-sm text-muted-foreground">{language==="pt"?"Somente estas empresas poderão agendar nesta clínica.":"Only these companies can schedule at this clinic."}</p></div>
      {!approved.length?<p className="text-sm text-muted-foreground">{language==="pt"?"Não há empresas aprovadas disponíveis.":"No approved companies are available."}</p>:<div className="grid gap-2 sm:grid-cols-2">{approved.map(company=><label key={company.id} className="flex items-center gap-3 rounded-md border p-3"><Checkbox checked={selectedCompanies.includes(company.id)} onCheckedChange={()=>toggleCompany(company.id)}/><span className="text-sm">{company.trade_name||company.legal_name}</span></label>)}</div>}
    </div>
    <div className="space-y-3 border-t pt-5">
      <div><p className="font-semibold">{language==="pt"?"Agenda de atendimento":"Service schedule"}</p><p className="text-sm text-muted-foreground">{language==="pt"?"Defina dias, horários e duração de cada intervalo.":"Set days, hours and slot duration."}</p></div>
      <div className="space-y-3">{schedule.map(day=><div key={day.weekday} className="grid items-center gap-2 rounded-md border p-3 sm:grid-cols-[1.3fr_auto_1fr_1fr_110px]"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={day.enabled} onCheckedChange={value=>updateDay(day.weekday,"enabled",Boolean(value))}/>{days[day.weekday]}</label><span className="text-xs text-muted-foreground">{day.enabled?(language==="pt"?"Ativo":"Active"):(language==="pt"?"Fechado":"Closed")}</span><Input type="time" value={day.start_time} disabled={!day.enabled} onChange={e=>updateDay(day.weekday,"start_time",e.target.value)}/><Input type="time" value={day.end_time} disabled={!day.enabled} onChange={e=>updateDay(day.weekday,"end_time",e.target.value)}/><Input type="number" min={5} max={240} step={5} value={day.slot_minutes} disabled={!day.enabled} onChange={e=>updateDay(day.weekday,"slot_minutes",Number(e.target.value))}/></div>)}</div>
    </div>
    {error&&<p className="text-sm text-destructive">{error}</p>}
  </DialogFrame>;
}
function AppointmentDialog({open,onClose,onSaved,employees,exams,profile,companies,functions,locations,locationSchedules,employeeExamIds,isMaster}:{open:boolean;onClose:()=>void;onSaved:()=>void;employees:Employee[];exams:Exam[];profile:Profile|null;companies:Company[];functions:OccupationalFunction[];locations:(ExamLocation & {companies:LocationCompany[];schedule_rules:LocationScheduleRule[]})[];locationSchedules:LocationScheduleRule[];employeeExamIds:Record<string,string[]>;isMaster:boolean}) {
  const [error,setError]=useState("");
  const [companyId,setCompanyId]=useState(profile?.company_id??"");
  const [cpf,setCpf]=useState("");
  const [employee,setEmployee]=useState<Employee|null>(null);
  const [lookupDone,setLookupDone]=useState(false);
  const [lookupLoading,setLookupLoading]=useState(false);
  const [functionId,setFunctionId]=useState("");
  const [selectedExamIds,setSelectedExamIds]=useState<string[]>([]);
  const [clinicId,setClinicId]=useState("");
  const [slotKey,setSlotKey]=useState("");
  const [assessmentType,setAssessmentType]=useState("admission");
  const [slots,setSlots]=useState<{key:string;startsAt:string;endsAt:string;label:string}[]>([]);
  const [employeeFields,setEmployeeFields]=useState({full_name:"",rg:"",birthplace:"",nationality:"",birth_date:"",sex:"not_informed",job_title:"",admission_date:"",workplace:""});
  const runCreateAppointment=useServerFn(createAppointmentFromClinic);
  const selectedFunction=functions.find(item=>item.id===functionId);
  const selectedClinic=locations.find(item=>item.id===clinicId);
  const availableClinics=locations.filter(item=>{
    if(!item.is_active||!companyId)return false;
    const linkedFromClinic=(item.companies??[]).some(link=>link.company_id===companyId);
    const linkedFromState=locationCompanies.some(link=>link.location_id===item.id&&link.company_id===companyId);
    return linkedFromClinic||linkedFromState;
  });
  const employeeExamIdList=employee?(employeeExamIds[employee.id]??[]):[];
  const functionExamIdList=selectedFunction?.occupational_function_exams?.map(item=>item.exam_id)??[];
  const effectiveExamIds=employee?Array.from(new Set([...employeeExamIdList,...functionExamIdList])):selectedExamIds;
  const availableExams=exams.filter(item=>item.is_active&&effectiveExamIds.includes(item.id));

  useEffect(()=>{
    if(!open)return;
    setError("");
    setCompanyId(profile?.company_id??"");
    setCpf("");
    setEmployee(null);
    setLookupDone(false);
    setLookupLoading(false);
    setFunctionId("");
    setSelectedExamIds([]);
    setClinicId("");
    setSlotKey("");
    setAssessmentType("admission");
    setSlots([]);
    setEmployeeFields({full_name:"",rg:"",birthplace:"",nationality:"",birth_date:"",sex:"not_informed",job_title:"",admission_date:"",workplace:""});
  },[open,profile?.company_id]);
  useEffect(()=>{
    if(!open||!isMaster||companyId)return;
    const approved=companies.filter(item=>item.status==="approved");
    if(approved.length===1)setCompanyId(approved[0].id);
  },[open,isMaster,companyId,companies]);
  useEffect(()=>{if(employee){setFunctionId(employee.occupational_function_id??"");setEmployeeFields({full_name:employee.full_name,rg:employee.rg??"",birthplace:employee.birthplace,nationality:employee.nationality,birth_date:employee.birth_date,sex:employee.sex,job_title:employee.job_title,admission_date:employee.admission_date??"",workplace:employee.workplace});setSelectedExamIds(employeeExamIds[employee.id]??[]);}},[employee,employeeExamIds]);
  useEffect(()=>{if(functionId&&!employee)setSelectedExamIds(selectedFunction?.occupational_function_exams?.map(item=>item.exam_id)??[]);},[functionId,employee,selectedFunction]);
  useEffect(()=>{
    if(!selectedClinic){setSlots([]);setSlotKey("");return;}
    const generated:{key:string;startsAt:string;endsAt:string;label:string}[]=[];const now=Date.now();
    const rules=(selectedClinic.schedule_rules?.length?selectedClinic.schedule_rules:locationSchedules.filter(item=>item.location_id===selectedClinic.id));
    for(let offset=0;offset<60&&generated.length<400;offset++){
      const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()+offset);const weekday=date.getDay();
      for(const rule of rules.filter(item=>item.is_active&&item.weekday===weekday)){
        const [sh,sm]=String(rule.start_time).slice(0,5).split(":").map(Number);const [eh,em]=String(rule.end_time).slice(0,5).split(":").map(Number);
        for(let minute=sh*60+sm;minute+Number(rule.slot_minutes)<=eh*60+em;minute+=Number(rule.slot_minutes)){
          const startDate=new Date(date);startDate.setHours(Math.floor(minute/60),minute%60,0,0);const endDate=new Date(startDate.getTime()+Number(rule.slot_minutes)*60000);
          if(startDate.getTime()<=now)continue;
          generated.push({key:startDate.toISOString(),startsAt:startDate.toISOString(),endsAt:endDate.toISOString(),label:startDate.toLocaleDateString("pt-BR")+" · "+startDate.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+"–"+endDate.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})});
          if(generated.length>=400)break;
        }
        if(generated.length>=400)break;
      }
    }
    setSlots(generated);setSlotKey(generated[0]?.key??"");
  },[selectedClinic]);

  async function lookupEmployee(){
    const normalized=cpf.replace(/\D/g,"");if(normalized.length!==11){setError("Informe os 11 dígitos do CPF.");return;}if(!companyId){setError("Selecione a empresa antes de consultar o CPF.");return;}
    setLookupLoading(true);setError("");setLookupDone(false);
    const {data:found,error:lookupError}=await supabase.from("employees").select("*").eq("company_id",companyId).eq("cpf",normalized).maybeSingle();
    setLookupLoading(false);
    if(lookupError){setError("Não foi possível consultar o CPF.");return;}
    if(found){setEmployee(found as Employee);setLookupDone(true);return;}
    setEmployee(null);setFunctionId("");setSelectedExamIds([]);setEmployeeFields({full_name:"",rg:"",birthplace:"",nationality:"",birth_date:"",sex:"not_informed",job_title:"",admission_date:"",workplace:""});setLookupDone(true);
  }
  function formatCpfInput(value:string){const digits=value.replace(/\D/g,"").slice(0,11);return digits.replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/,"$1.$2.$3-$4");}
  function handleCpfChange(value:string){const formatted=formatCpfInput(value);setCpf(formatted);if(employee||lookupDone){setEmployee(null);setLookupDone(false);setFunctionId("");setSelectedExamIds([]);setEmployeeFields({full_name:"",rg:"",birthplace:"",nationality:"",birth_date:"",sex:"not_informed",job_title:"",admission_date:"",workplace:""});}}

  function updateEmployeeField(key:keyof typeof employeeFields,value:string){setEmployeeFields(current=>({...current,[key]:value}));}

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    if(!companyId){setError("Selecione a empresa.");return;}if(!selectedClinic){setError("Selecione uma clínica habilitada para a empresa.");return;}
    const slot=slots.find(item=>item.key===slotKey);if(!slot){setError("Selecione um horário disponível.");return;}if(!functionId){setError("Selecione a função ocupacional.");return;}
    const normalizedCpf=cpf.replace(/\D/g,"");if(normalizedCpf.length!==11){setError("Informe os 11 dígitos do CPF.");return;}
    let employeeId=employee?.id??"";let examIds=employee?(selectedExamIds.length?selectedExamIds:(employeeExamIds[employee.id]??[])):selectedExamIds;
    if(!employee){
      const user=(await supabase.auth.getUser()).data.user;
      if(!user){setError("Verifique sua sessão.");return;}
      const {data:existing,error:existingError}=await supabase.from("employees").select("*").eq("company_id",companyId).eq("cpf",normalizedCpf).maybeSingle();
      if(existingError){setError("Não foi possível verificar o CPF.");return;}
      if(existing){
        employeeId=existing.id;setEmployee(existing as Employee);setFunctionId(existing.occupational_function_id??functionId);examIds=selectedExamIds.length?selectedExamIds:(employeeExamIds[existing.id]??[]);setEmployeeFields({full_name:existing.full_name,rg:existing.rg??"",birthplace:existing.birthplace,nationality:existing.nationality,birth_date:existing.birth_date,sex:existing.sex,job_title:existing.job_title,admission_date:existing.admission_date??"",workplace:existing.workplace});
      } else {
      const values={company_id:companyId,full_name:employeeFields.full_name.trim(),cpf:normalizedCpf,rg:employeeFields.rg.trim()||null,birthplace:employeeFields.birthplace.trim(),nationality:employeeFields.nationality.trim(),birth_date:employeeFields.birth_date,sex:employeeFields.sex,job_title:employeeFields.job_title.trim(),occupational_function_id:functionId,admission_date:employeeFields.admission_date.trim()||null,workplace:employeeFields.workplace.trim(),created_by:user.id};
      if(values.full_name.length<2||!values.birthplace||!values.nationality||!values.birth_date||!values.job_title||!values.workplace){setError("Preencha todos os dados obrigatórios do funcionário.");return;}
      const {data:createdEmployee,error:employeeError}=await supabase.from("employees").insert(values).select("*").single();
      if(employeeError||!createdEmployee){setError(employeeError?.message??"Não foi possível cadastrar o funcionário.");return;}
      employeeId=createdEmployee.id;
      if(selectedExamIds.length){const {error:examError}=await supabase.from("employee_exams").insert(selectedExamIds.map(exam_id=>({employee_id:employeeId,exam_id})));if(examError){await supabase.from("employees").delete().eq("id",employeeId);setError(examError.message);return;}}
      examIds=selectedExamIds;
      }
    }
    if(!examIds.length){setError("Este funcionário não possui exames cadastrados.");return;}
    try{await runCreateAppointment({data:{employeeId,companyId,clinicId:clinicId,startsAt:slot.startsAt,endsAt:slot.endsAt,assessmentType:assessmentType as "admission"|"periodic"|"return_to_work"|"risk_change"|"dismissal",jobTitle:employeeFields.job_title.trim(),examIds,notes:String(new FormData(e.currentTarget).get("notes")??"").trim()||null}});onSaved();}catch(saveError){setError(saveError instanceof Error?saveError.message:"Não foi possível criar o agendamento.");}
  }

  return <DialogFrame open={open} onClose={onClose} onSubmit={submit} title="Novo agendamento" description="Consulte o funcionário pelo CPF, confirme os dados, selecione a clínica da empresa e o horário.">
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div className="space-y-2"><Label htmlFor="appointment-cpf">CPF do funcionário</Label><Input id="appointment-cpf" value={cpf} onChange={event=>handleCpfChange(event.target.value)} inputMode="numeric" maxLength={14} placeholder="000.000.000-00"/></div><Button type="button" variant="outline" className="mt-8" onClick={()=>void lookupEmployee()} disabled={lookupLoading}>{lookupLoading?"Consultando...":"Consultar CPF"}</Button></div>
      {lookupDone&&<p className="text-sm text-muted-foreground">{employee?"Funcionário encontrado. Confira os dados antes de confirmar.":"CPF não encontrado. Preencha os dados para cadastrar o novo funcionário."}</p>}
      {isMaster&&<div className="space-y-2"><Label>Empresa</Label><Select value={companyId} onValueChange={value=>{setCompanyId(value);setCpf("");setEmployee(null);setLookupDone(false);setClinicId("");setSlotKey("");}}><SelectTrigger><SelectValue placeholder="Selecionar empresa"/></SelectTrigger><SelectContent>{companies.filter(item=>item.status==="approved").map(item=><SelectItem key={item.id} value={item.id}>{item.trade_name||item.legal_name}</SelectItem>)}</SelectContent></Select></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Nome completo</Label><Input value={employeeFields.full_name} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("full_name",event.target.value)} required/></div>
        <div className="space-y-2"><Label>RG</Label><Input value={employeeFields.rg} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("rg",event.target.value)}/></div>
        <div className="space-y-2"><Label>Naturalidade</Label><Input value={employeeFields.birthplace} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("birthplace",event.target.value)} required/></div>
        <div className="space-y-2"><Label>Nacionalidade</Label><Input value={employeeFields.nationality} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("nationality",event.target.value)} required/></div>
        <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={employeeFields.birth_date} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("birth_date",event.target.value)} required/></div>
        <div className="space-y-2"><Label>Sexo</Label><Select value={employeeFields.sex} onValueChange={value=>updateEmployeeField("sex",value)} disabled={Boolean(employee)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="female">Feminino</SelectItem><SelectItem value="male">Masculino</SelectItem><SelectItem value="other">Outro</SelectItem><SelectItem value="not_informed">Não informado</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Função</Label><Input value={employeeFields.job_title} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("job_title",event.target.value)} required/></div>
        <div className="space-y-2"><Label>Data de admissão</Label><Input type="date" value={employeeFields.admission_date} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("admission_date",event.target.value)}/></div>
        <div className="space-y-2 sm:col-span-2"><Label>Posto de trabalho</Label><Input value={employeeFields.workplace} readOnly={Boolean(employee)} onChange={event=>updateEmployeeField("workplace",event.target.value)} required/></div>
        <div className="space-y-2 sm:col-span-2"><Label>Função ocupacional cadastrada</Label><Select value={functionId} onValueChange={setFunctionId} disabled={Boolean(employee)}><SelectTrigger><SelectValue placeholder="Selecionar função"/></SelectTrigger><SelectContent>{functions.filter(item=>item.is_active&&item.company_id===companyId).map(item=><SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="space-y-3 border-t pt-5"><div><p className="font-semibold">Exames a realizar</p><p className="text-sm text-muted-foreground">{employee?"Exames já cadastrados para este funcionário foram carregados automaticamente.":"A função selecionada sugere os exames cadastrados para a função; eles serão vinculados ao funcionário."}</p></div>{!availableExams.length?<p className="rounded-md border p-3 text-sm text-muted-foreground">Nenhum exame cadastrado para este funcionário/função.</p>:<div className="grid gap-2 sm:grid-cols-2">{availableExams.map(exam=><label key={exam.id} className="flex items-center gap-3 rounded-md border p-3"><Checkbox checked={selectedExamIds.includes(exam.id)} onCheckedChange={()=>setSelectedExamIds(current=>current.includes(exam.id)?current.filter(id=>id!==exam.id):[...current,exam.id])}/><span className="text-sm">{exam.name_pt}</span></label>)}</div>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Tipo ocupacional</Label><Select value={assessmentType} onValueChange={setAssessmentType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="admission">Admissional</SelectItem><SelectItem value="periodic">Periódico</SelectItem><SelectItem value="return_to_work">Retorno ao trabalho</SelectItem><SelectItem value="risk_change">Mudança de risco</SelectItem><SelectItem value="dismissal">Demissional</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Clínica de atendimento</Label><Select value={clinicId} onValueChange={value=>{setClinicId(value);setSlotKey("");}}><SelectTrigger><SelectValue placeholder="Selecionar clínica"/></SelectTrigger><SelectContent>{availableClinics.map(item=><SelectItem key={item.id} value={item.id}>{item.name} · {item.city}/{item.state}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 sm:col-span-2"><Label>Horário disponível</Label><Select value={slotKey} onValueChange={setSlotKey} disabled={!clinicId}><SelectTrigger><SelectValue placeholder={clinicId?"Selecionar horário":"Selecione primeiro a clínica"}/></SelectTrigger><SelectContent>{slots.map(slot=><SelectItem key={slot.key} value={slot.key}>{slot.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="appointment-notes">Observações</Label><Textarea id="appointment-notes" name="notes" maxLength={2000}/></div>
      </div>
      {error&&<p className="text-sm text-destructive">{error}</p>}
    </div>
  </DialogFrame>;
}
function JoinDialog({open,onClose,onSaved}:{open:boolean;onClose:()=>void;onSaved:()=>void}){const [error,setError]=useState("");async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const {error:joinError}=await supabase.rpc("join_company_with_code",{_plain_code:String(f.get("code"))});if(joinError)setError("Código inválido, expirado ou empresa ainda não aprovada.");else onSaved();}return <DialogFrame open={open} onClose={onClose} onSubmit={submit} title="Vincular à empresa" description="Insira o código de acesso fornecido pelo administrador."><Field label="Código da empresa" name="code"/>{error&&<p className="text-sm text-destructive">{error}</p>}</DialogFrame>}
function formatCnpj(v:string){return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
function formatCpf(v:string){return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}