import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Upload } from "lucide-react";
import Papa from "papaparse";
import { importMasterRows } from "@/lib/bulk-import.functions";
import { downloadImportFile, parseImportCsv, templateCsv, type ImportKind, type ImportOutcome } from "@/lib/bulk-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function BulkImportDialog({ kind, language, onClose, onSaved }: { kind: ImportKind; language: "pt" | "en"; onClose: () => void; onSaved: () => Promise<void> }) {
  const runImport = useServerFn(importMasterRows);
  const [rows, setRows] = useState<ReturnType<typeof parseImportCsv>>([]);
  const [results, setResults] = useState<ImportOutcome[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const running = useRef(false);
  const tr = (pt: string, en: string) => language === "pt" ? pt : en;
  const describe = (code: string) => {
    if (code.startsWith("invalid:")) return tr("Campos inválidos: ", "Invalid fields: ") + code.slice(8);
    const messages: Record<string, string> = {
      saved: tr("Importado", "Imported"), exists: tr("Já cadastrado; mantido sem alterações", "Already registered; unchanged"),
      duplicate: tr("Repetido no arquivo", "Duplicate in file"), registry_unavailable: tr("CNPJ não encontrado ou consulta indisponível", "CNPJ not found or registry unavailable"),
      company_not_approved: tr("Empresa não encontrada ou não aprovada", "Company not found or not approved"), function_inactive: tr("Função cadastrada está inativa", "Registered function is inactive"),
      save_failed: tr("Não foi possível salvar; tente novamente", "Could not save; try again"),
    };
    return messages[code] ?? code;
  };
  const valid = rows.filter(r => !r.issues.length);
  async function readFile(file?: File) {
    if (!file) return;
    setRows([]); setResults([]); setError(""); setDone(false);
    if (file.size > 2 * 1024 * 1024) { setError(tr("Arquivo muito grande (máximo 2 MB).", "File too large (maximum 2 MB).")); return; }
    try { setRows(parseImportCsv(await file.text(), kind)); }
    catch (e) { setError(e instanceof Error && e.message === "count" ? tr("O arquivo deve conter entre 1 e 500 registros.", "The file must contain 1–500 records.") : tr("CSV inválido. Use as colunas do modelo e salve em UTF-8.", "Invalid CSV. Use the template columns and save as UTF-8.")); }
  }
  async function submit() {
    if (running.current || !valid.length || done) return;
    running.current = true; setBusy(true); setError("");
    const collected: ImportOutcome[] = [];
    try {
      for (let i = 0; i < valid.length; i += 5) {
        const batch = valid.slice(i, i + 5).map(({ row, data }) => ({ row, data }));
        collected.push(...await runImport({ data: { kind, rows: batch } }));
        setResults([...collected]);
      }
      setDone(true);
    } catch { setError(tr("Importação interrompida. Reenvie o arquivo; cadastros já salvos não serão duplicados.", "Import interrupted. Re-upload the file; saved records will not be duplicated.")); }
    finally { running.current = false; setBusy(false); if (collected.some(r => r.status === "imported")) await onSaved(); }
  }
  function report() {
    const data = rows.map(r => {
      const result = results.find(v => v.row === r.row);
      return [r.row, kind === "companies" ? r.data["cnpj"] : r.data["cpf"], result ? describe(result.code) : r.issues.length ? describe(r.issues[0] === "duplicate" ? "duplicate" : "invalid:" + r.issues.join(", ")) : tr("Não processado", "Not processed")];
    });
    downloadImportFile("\uFEFF" + Papa.unparse({ fields: [tr("linha", "row"), "cnpj_cpf", tr("resultado", "result")], data }, { delimiter: ";", escapeFormulae: true }), `resultado-${kind}.csv`);
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>{kind === "companies" ? tr("Importar empresas", "Import companies") : tr("Importar funcionários", "Import employees")}</DialogTitle><DialogDescription>{tr("Cadastros existentes serão mantidos sem alterações.", "Existing records will remain unchanged.")}</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadImportFile(templateCsv(kind), `modelo-${kind === "companies" ? "empresas" : "funcionarios"}.csv`)}><Download/>{tr("Baixar modelo CSV", "Download CSV template")}</Button></div>
    <p className="text-sm text-muted-foreground">{kind === "companies" ? tr("CNPJ obrigatório. A consulta cadastral preenche campos vazios; empresas importadas aguardam aprovação.", "CNPJ required. Registry lookup fills blank fields; imported companies await approval.") : tr("Use o CNPJ de uma empresa aprovada. Datas: AAAA-MM-DD. Sexo: feminino, masculino, outro ou nao_informado. RG e admissão são opcionais.", "Use an approved company's CNPJ. Dates: YYYY-MM-DD. Sex: female, male, other or not_informed. RG and admission date are optional.")}</p>
    <div className="space-y-2"><Label htmlFor="bulk-csv">{tr("Arquivo CSV preenchido", "Completed CSV file")}</Label><Input id="bulk-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={event => void readFile(event.target.files?.[0])}/></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {rows.length > 0 && <><p role="status" className="text-sm">{tr("Válidos", "Valid")}: {valid.length} · {tr("Com erros", "With errors")}: {rows.length - valid.length} · {tr("Processados", "Processed")}: {results.length}/{valid.length}{done && ` · ${tr("Importados", "Imported")}: ${results.filter(r => r.status === "imported").length}`}</p><div className="max-h-72 overflow-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-3">{tr("Linha", "Row")}</th><th className="p-3">{tr("Cadastro", "Record")}</th><th className="p-3">{tr("Situação", "Status")}</th></tr></thead><tbody>{rows.map(r => { const result = results.find(v => v.row === r.row); return <tr key={r.row} className="border-t"><td className="p-3">{r.row}</td><td className="p-3"><span className="block break-words">{r.data["nome_completo"] || r.data["razao_social"] || "—"}</span><small className="text-muted-foreground">{r.data["cpf"] || r.data["cnpj"]}</small></td><td className={`p-3 ${r.issues.length || result?.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{result ? describe(result.code) : r.issues.length ? describe(r.issues[0] === "duplicate" ? "duplicate" : "invalid:" + r.issues.join(", ")) : tr("Pronto para importar", "Ready to import")}</td></tr>; })}</tbody></table></div></>}
    <DialogFooter className="flex-wrap gap-2">{rows.length > 0 && <Button variant="outline" onClick={report} disabled={busy}><Download/>{tr("Baixar resultado", "Download results")}</Button>}<Button variant="outline" onClick={onClose} disabled={busy}>{tr("Fechar", "Close")}</Button><Button disabled={busy || !valid.length || done} onClick={() => void submit()}><Upload/>{busy ? tr("Importando…", "Importing…") : tr("Importar registros válidos", "Import valid records")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}