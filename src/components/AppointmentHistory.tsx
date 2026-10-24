import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { appointmentIdentity, filterAppointmentHistory, type AppointmentRecord } from "@/lib/appointment-record";

type HistoryRow = AppointmentRecord & {
  id: string; employee_id: string; company_id: string; starts_at: string; location: string; status: string;
};

export function AppointmentHistory({ rows, language, companies }: {
  rows: HistoryRow[]; language: "pt" | "en"; companies: { id: string; legal_name: string; trade_name: string | null }[];
}) {
  const pt = language === "pt";
  const [query, setQuery] = useState("");
  const [employeeId, setEmployeeId] = useState("all");
  const workers = Array.from(new Map(rows.map(row => [row.employee_id, appointmentIdentity(row)])).entries());
  const filtered = filterAppointmentHistory(rows, query, employeeId === "all" ? "" : employeeId)
    .toSorted((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const statuses: Record<string, string> = pt
    ? { scheduled: "Agendado", confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado" }
    : { scheduled: "Scheduled", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };
  return <section className="mt-8 border-t pt-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-semibold">{pt ? "Histórico de agendamentos" : "Appointment history"}</h3>
      <span className="text-sm text-muted-foreground">{filtered.length} {pt ? "agendamentos" : "appointments"}</span>
    </div>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label={pt ? "Pesquisar histórico por nome ou CPF" : "Search history by name or CPF"} className="pl-9" placeholder={pt ? "Nome, CPF ou código" : "Name, CPF or code"} value={query} onChange={e => setQuery(e.target.value)}/></div>
      <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger className="w-full sm:w-72" aria-label={pt ? "Trabalhador do histórico" : "History worker"}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{pt ? "Todos os trabalhadores" : "All workers"}</SelectItem>{workers.map(([id, worker]) => <SelectItem key={id} value={id}>{worker.full_name} · {worker.cpf}</SelectItem>)}</SelectContent></Select>
      {(query || employeeId !== "all") && <Button variant="outline" onClick={() => { setQuery(""); setEmployeeId("all"); }}>{pt ? "Limpar filtros" : "Clear filters"}</Button>}
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">{[pt ? "Código" : "Code", pt ? "Nome" : "Name", "CPF", pt ? "Função" : "Job title", pt ? "Data e hora" : "Date and time", pt ? "Local / Empresa" : "Location / Company", pt ? "Situação" : "Status"].map(label => <th key={label} className="p-3 font-semibold">{label}</th>)}</tr></thead><tbody>{filtered.map(row => { const worker = appointmentIdentity(row); const company = companies.find(c => c.id === row.company_id); return <tr key={row.id} className="border-b last:border-0"><td className="max-w-56 break-all p-3 font-mono text-xs">{row.appointment_code}</td><td className="p-3 font-medium">{worker.full_name || "—"}</td><td className="whitespace-nowrap p-3 tabular-nums">{worker.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") || "—"}</td><td className="p-3">{worker.job_title || "—"}</td><td className="whitespace-nowrap p-3">{new Date(row.starts_at).toLocaleString(pt ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short" })}</td><td className="p-3">{row.location}<span className="block text-xs text-muted-foreground">{company?.trade_name || company?.legal_name}</span></td><td className="p-3">{statuses[row.status] ?? row.status}</td></tr>; })}</tbody></table>{!filtered.length && <p className="py-8 text-center text-sm text-muted-foreground">{pt ? "Nenhum agendamento encontrado." : "No appointments found."}</p>}</div>
  </section>;
}