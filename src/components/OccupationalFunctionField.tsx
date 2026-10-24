import { useId } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OccupationalFunctionField({ value, functions, onChange, onCreate, busy, disabled, language }: {
  value: string;
  functions: { id: string; name: string }[];
  onChange: (name: string, id: string) => void;
  onCreate: () => void;
  busy: boolean;
  disabled: boolean;
  language: "pt" | "en";
}) {
  const id = useId();
  const existing = functions.find(fn => fn.name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase());
  return <div className="space-y-2 sm:col-span-2">
    <Label htmlFor={id}>{language === "pt" ? "Função" : "Job title"}</Label>
    <div className="flex gap-2">
      <Input id={id} name="job_title" value={value} list={`${id}-options`} required maxLength={120} disabled={disabled || busy}
        placeholder={language === "pt" ? "Selecionar ou cadastrar função" : "Select or add a job title"}
        onChange={event => {
          const name = event.target.value;
          const selected = functions.find(fn => fn.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
          onChange(selected?.name ?? name, selected?.id ?? "");
        }} />
      <datalist id={`${id}-options`}>{functions.map(fn => <option key={fn.id} value={fn.name} />)}</datalist>
      <Button type="button" variant="outline" onClick={onCreate} disabled={disabled || busy || Boolean(existing) || value.trim().length < 2}>
        <Plus />{busy ? (language === "pt" ? "Salvando…" : "Saving…") : (language === "pt" ? "Cadastrar" : "Add")}
      </Button>
    </div>
  </div>;
}