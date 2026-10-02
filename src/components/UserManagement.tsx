import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound, Search, ShieldOff, UserRound } from "lucide-react";
import { listManagedUsers, resetManagedUserPassword, setManagedUserApproval } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ManagedUser = Awaited<ReturnType<typeof listManagedUsers>>[number];

export function UserManagement({ language }: { language: "pt" | "en" }) {
  const listUsers = useServerFn(listManagedUsers);
  const resetPassword = useServerFn(resetManagedUserPassword);
  const setApproval = useServerFn(setManagedUserApproval);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listUsers().then(setUsers).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Erro ao carregar usuários.")).finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((user) => `${user.fullName} ${user.email} ${user.companyName ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const text = language === "pt" ? {
    title: "Usuários e acessos", subtitle: "Aprove novos cadastros, vincule empresas e redefina senhas.", search: "Buscar usuário", name: "Usuário", company: "Empresa", access: "Acesso", action: "Ação", change: "Alterar senha", approve: "Aprovar", suspend: "Suspender", active: "Liberado", pending: "Pendente", dialog: "Definir nova senha", description: "Crie uma senha temporária com pelo menos 8 caracteres.", password: "Nova senha", cancel: "Cancelar", save: "Salvar senha", success: "Senha alterada com sucesso.", approvalSuccess: "Acesso atualizado com sucesso.", empty: "Nenhum usuário encontrado.", loading: "Carregando usuários...",
  } : {
    title: "Users and access", subtitle: "Approve new registrations, link companies, and reset passwords.", search: "Search users", name: "User", company: "Company", access: "Access", action: "Action", change: "Change password", approve: "Approve", suspend: "Suspend", active: "Approved", pending: "Pending", dialog: "Set new password", description: "Create a temporary password with at least 8 characters.", password: "New password", cancel: "Cancel", save: "Save password", success: "Password changed successfully.", approvalSuccess: "Access updated successfully.", empty: "No users found.", loading: "Loading users...",
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await resetPassword({ data: { userId: selected.id, password: String(form.get("password")) } });
      setSelected(null); setMessage(text.success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao alterar senha.");
    }
  }

  async function changeApproval(user: ManagedUser) {
    try {
      await setApproval({ data: { userId: user.id, approved: !user.isActive } });
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, isActive: !item.isActive } : item));
      setMessage(text.approvalSuccess);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao alterar acesso.");
    }
  }

  return <>
    <header className="mb-7"><h2 className="text-2xl font-semibold">{text.title}</h2><p className="mt-1 text-muted-foreground">{text.subtitle}</p></header>
    {message && <p className="mb-4 rounded-md border bg-muted p-3 text-sm">{message}</p>}
    <div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></div>
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="hidden grid-cols-[1.5fr_1fr_.7fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid"><span>{text.name}</span><span>{text.company}</span><span>{text.access}</span><span>{text.action}</span></div>
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">{text.loading}</p> : filtered.map((user) => <div key={user.id} className="grid gap-3 border-b px-4 py-4 last:border-0 md:grid-cols-[1.5fr_1fr_.7fr_auto] md:items-center"><span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent"><UserRound className="size-4"/></span><span className="min-w-0"><b className="block truncate text-sm">{user.fullName}</b><small className="block truncate text-muted-foreground">{user.email}</small></span></span><span className="text-sm">{user.companyName ?? "—"}</span><span className="text-sm"><b className={user.isActive ? "text-success" : "text-warning"}>{user.isActive ? text.active : text.pending}</b><small className="block text-muted-foreground">{user.role === "master" ? "Master" : language === "pt" ? "Empresa" : "Company"}</small></span><span className="flex flex-wrap justify-end gap-2"><Button size="sm" variant={user.isActive ? "outline" : "default"} onClick={() => void changeApproval(user)}>{user.isActive ? <ShieldOff/> : <Check/>}{user.isActive ? text.suspend : text.approve}</Button><Button size="sm" variant="outline" onClick={() => { setSelected(user); setMessage(""); }}><KeyRound/>{text.change}</Button></span></div>)}
      {!loading && !filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">{text.empty}</p>}
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{text.dialog}</DialogTitle><DialogDescription>{selected?.fullName} · {text.description}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label htmlFor="managed-password">{text.password}</Label><Input id="managed-password" name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password"/></div><DialogFooter><Button type="button" variant="outline" onClick={() => setSelected(null)}>{text.cancel}</Button><Button type="submit">{text.save}</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}