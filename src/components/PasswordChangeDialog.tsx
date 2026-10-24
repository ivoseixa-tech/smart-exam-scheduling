import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { changeOwnPassword } from "@/lib/user-auth.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordChangeDialog({ language, initial = false, onSaved }: { language: "pt" | "en"; initial?: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const change = useServerFn(changeOwnPassword);
  const pt = language === "pt";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== form.get("confirmation")) { setMessage(pt ? "As senhas não coincidem." : "Passwords do not match."); return; }
    setBusy(true); setMessage("");
    try { await change({ data: { currentPassword: String(form.get("currentPassword")), password } }); setOpen(false); onSaved(); }
    catch (error) { setMessage(error instanceof Error ? error.message : pt ? "Não foi possível alterar a senha." : "Could not change password."); }
    finally { setBusy(false); }
  }
  return <><Button variant="ghost" size="sm" onClick={() => { setMessage(""); setOpen(true); }}><KeyRound/>{pt ? "Alterar minha senha" : "Change my password"}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{initial ? pt ? "Senha do primeiro acesso" : "First sign-in password" : pt ? "Alterar minha senha" : "Change my password"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}>{[{ name: "currentPassword", label: pt ? "Senha atual" : "Current password", auto: "current-password" },{ name: "password", label: pt ? "Nova senha" : "New password", auto: "new-password" },{ name: "confirmation", label: pt ? "Confirmar nova senha" : "Confirm new password", auto: "new-password" }].map(field => <div key={field.name} className="space-y-2"><Label htmlFor={`own-${field.name}`}>{field.label}</Label><Input id={`own-${field.name}`} name={field.name} type="password" required minLength={field.name === "currentPassword" ? 1 : 8} maxLength={72} autoComplete={field.auto}/></div>)}{message && <p role="alert" className="text-sm text-destructive">{message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{pt ? "Depois" : "Later"}</Button><Button disabled={busy}>{pt ? "Salvar senha" : "Save password"}</Button></div></form></DialogContent></Dialog></>;
}