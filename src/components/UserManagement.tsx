import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound, Search, ShieldOff, UserRound, Plus, Pencil, Trash2 } from "lucide-react";
import { listManagedUsers, resetManagedUserPassword, setManagedUserApproval, createManagedUser, updateManagedUser, deleteManagedUser } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ManagedUser = Awaited<ReturnType<typeof listManagedUsers>>[number];

export function UserManagement({ language, companies }: { language: "pt" | "en"; companies: {id:string; legal_name:string; trade_name:string|null; status:string}[] }) {
  const listUsers = useServerFn(listManagedUsers);
  const resetPassword = useServerFn(resetManagedUserPassword);
  const setApproval = useServerFn(setManagedUserApproval);
  const createUser = useServerFn(createManagedUser);
  const updateUser = useServerFn(updateManagedUser);
  const deleteUser = useServerFn(deleteManagedUser);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listUsers().then(setUsers).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Erro ao carregar usuários.")).finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((user) => `${user.username} ${user.fullName} ${user.email} ${user.companyName ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const text = language === "pt" ? {
    title: "Usuários e acessos", subtitle: "Aprove novos cadastros, vincule empresas e redefina senhas.", search: "Buscar usuário", name: "Usuário", company: "Empresa", access: "Acesso", action: "Ação", change: "Alterar senha", approve: "Habilitar", suspend: "Desabilitar", active: "Liberado", pending: "Pendente", dialog: "Definir nova senha", description: "Crie uma senha temporária com pelo menos 8 caracteres.", password: "Nova senha", cancel: "Cancelar", save: "Salvar senha", success: "Senha alterada com sucesso.", approvalSuccess: "Acesso atualizado com sucesso.", empty: "Nenhum usuário encontrado.", loading: "Carregando usuários...",
  } : {
    title: "Users and access", subtitle: "Approve new registrations, link companies, and reset passwords.", search: "Search users", name: "User", company: "Company", access: "Access", action: "Action", change: "Change password", approve: "Enable", suspend: "Disable", active: "Approved", pending: "Pending", dialog: "Set new password", description: "Create a temporary password with at least 8 characters.", password: "New password", cancel: "Cancel", save: "Save password", success: "Password changed successfully.", approvalSuccess: "Access updated successfully.", empty: "No users found.", loading: "Loading users...",
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

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try {
      if (editing) await updateUser({ data: { userId: editing.id, username: String(form.get("username")), email: String(form.get("email")), fullName: String(form.get("fullName")), companyId: editing.role === "master" ? editing.companyId : String(form.get("companyId")) } });
      else await createUser({ data: { username: String(form.get("username")), email: String(form.get("email")), fullName: String(form.get("fullName")), companyId: String(form.get("companyId")), password: String(form.get("password")), active: form.get("active") === "on" } });
      setCreating(false); setEditing(null); setUsers(await listUsers()); setMessage(language === "pt" ? "Usuário salvo com sucesso." : "User saved successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro / Error"); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true); setMessage("");
    try {
      await deleteUser({ data: { userId: deleting.id } });
      setUsers((current) => current.filter((user) => user.id !== deleting.id));
      setDeleting(null);
      setMessage(language === "pt" ? "Usuário excluído. Os agendamentos e históricos foram preservados." : "User deleted. Appointments and history were preserved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro / Error"); }
    finally { setBusy(false); }
  }

  return <>
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">{text.title}</h2><Button onClick={() => {setCreating(true);setMessage("");}}><Plus/>{language === "pt" ? "Novo usuário" : "New user"}</Button></header>
    {message && <p className="mb-4 rounded-md border bg-muted p-3 text-sm">{message}</p>}
    <div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search}/></div>
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="hidden grid-cols-[1.5fr_1fr_.7fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid"><span>{text.name}</span><span>{text.company}</span><span>{text.access}</span><span>{text.action}</span></div>
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">{text.loading}</p> : filtered.map((user) => <div key={user.id} className="grid gap-3 border-b px-4 py-4 last:border-0 md:grid-cols-[1.5fr_1fr_.7fr_auto] md:items-center"><span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent"><UserRound className="size-4"/></span><span className="min-w-0"><b className="block truncate text-sm">{user.fullName}</b><small className="block truncate font-medium">{user.username}</small><small className="block truncate text-muted-foreground">{user.email}</small></span></span><span className="text-sm">{user.companyName ?? "—"}</span><span className="text-sm"><b className={user.isActive ? "text-success" : "text-warning"}>{user.isActive ? text.active : text.pending}</b><small className="block text-muted-foreground">{user.role === "master" ? "Master" : language === "pt" ? "Empresa" : "Company"}</small></span><span className="flex flex-wrap justify-end gap-2"><Button size="sm" variant={user.isActive ? "outline" : "default"} onClick={() => void changeApproval(user)}>{user.isActive ? <ShieldOff/> : <Check/>}{user.isActive ? text.suspend : text.approve}</Button><Button size="sm" variant="outline" onClick={() => { setSelected(user); setMessage(""); }}><KeyRound/>{text.change}</Button><Button size="sm" variant="ghost" aria-label={language === "pt" ? "Editar usuário" : "Edit user"} title={language === "pt" ? "Editar usuário" : "Edit user"} onClick={() => {setEditing(user);setMessage("");}}><Pencil/></Button><Button size="sm" variant="ghost" disabled={user.role === "master" || user.isSelf} aria-label={language === "pt" ? "Excluir usuário" : "Delete user"} title={user.role === "master" || user.isSelf ? language === "pt" ? "Conta mestre protegida" : "Protected master account" : language === "pt" ? "Excluir usuário" : "Delete user"} onClick={() => {setDeleting(user);setMessage("");}}><Trash2 className="text-destructive"/></Button></span></div>)}
      {!loading && !filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">{text.empty}</p>}
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{text.dialog}</DialogTitle><DialogDescription>{selected?.fullName} · {text.description}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label htmlFor="managed-password">{text.password}</Label><Input id="managed-password" name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password"/></div><DialogFooter><Button type="button" variant="outline" onClick={() => setSelected(null)}>{text.cancel}</Button><Button type="submit">{text.save}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={creating || Boolean(editing)} onOpenChange={(open) => { if (!open && !busy) {setCreating(false);setEditing(null);} }}><DialogContent><DialogHeader><DialogTitle>{editing ? language === "pt" ? "Editar usuário" : "Edit user" : language === "pt" ? "Novo usuário" : "New user"}</DialogTitle></DialogHeader><form onSubmit={saveAccount} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="account-username">{language === "pt" ? "Nome de usuário" : "Username"}</Label><Input id="account-username" name="username" defaultValue={editing?.username} required pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" autoComplete="off"/></div>
      <div className="space-y-2"><Label htmlFor="account-fullName">{language === "pt" ? "Nome completo" : "Full name"}</Label><Input id="account-fullName" name="fullName" defaultValue={editing?.fullName} minLength={2} maxLength={120} required/></div>
      <div className="space-y-2"><Label htmlFor="account-email">E-mail</Label><Input id="account-email" name="email" type="email" defaultValue={editing?.email} maxLength={255} required/></div>
      {!editing && <div className="space-y-2"><Label htmlFor="account-password">{language === "pt" ? "Senha inicial" : "Initial password"}</Label><Input id="account-password" name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password"/></div>}
      <div className="space-y-2"><Label htmlFor="account-company">{text.company}</Label><select id="account-company" name="companyId" defaultValue={editing?.companyId ?? ""} required={editing?.role !== "master"} disabled={editing?.role === "master"} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">{editing?.role === "master" ? "Master" : language === "pt" ? "Selecionar empresa" : "Select company"}</option>{companies.filter(c => c.status === "approved" || c.id === editing?.companyId).map(c => <option key={c.id} value={c.id}>{c.trade_name || c.legal_name}</option>)}</select></div>
      {!editing && <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked/>{language === "pt" ? "Acesso habilitado" : "Access enabled"}</label>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => {setCreating(false);setEditing(null);}}>{text.cancel}</Button><Button disabled={busy}>{language === "pt" ? "Salvar usuário" : "Save user"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => {if (!open && !busy) setDeleting(null);}}><DialogContent><DialogHeader><DialogTitle>{language === "pt" ? "Excluir usuário?" : "Delete user?"}</DialogTitle><DialogDescription>{deleting?.fullName} · {deleting?.username}<br/>{language === "pt" ? "O acesso será removido permanentemente. Os agendamentos e históricos serão preservados." : "Access will be permanently removed. Appointments and history will be preserved."}</DialogDescription></DialogHeader>{message && <p role="alert" className="text-sm text-destructive">{message}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>{text.cancel}</Button><Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}><Trash2/>{language === "pt" ? "Excluir usuário" : "Delete user"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}