import Papa from "papaparse";
import { z } from "zod";

export type ImportKind = "companies" | "employees";
export type ImportRow = Record<string, string>;
export type ImportOutcome = { row: number; status: "imported" | "skipped" | "error"; code: string };
export const companyHeaders = ["cnpj", "razao_social", "nome_fantasia", "situacao_cadastral", "cnae", "descricao_cnae", "email", "telefone", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "cep"];
export const employeeHeaders = ["cnpj_empresa", "nome_completo", "cpf", "rg", "naturalidade", "nacionalidade", "data_nascimento", "sexo", "funcao", "data_admissao", "posto_trabalho"];
const text = z.string().trim().max(500);
const required = text.min(1);
const digits = (length: number) => text.transform(v => v.replace(/[.\-/\s]/g, "")).pipe(z.string().regex(new RegExp(`^\\d{${length}}$`)));
const date = text.refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "YYYY-MM-DD");
const optional = text.optional().default("");
const sexValues: Record<string, string> = { feminino: "female", masculino: "male", outro: "other", nao_informado: "not_informed" };
export const companyImportSchema = z.object({
  cnpj: digits(14), razao_social: optional, nome_fantasia: optional, situacao_cadastral: optional,
  cnae: optional, descricao_cnae: optional, email: optional.refine(v => !v || z.string().email().safeParse(v).success),
  telefone: optional, logradouro: optional, numero: optional, complemento: optional, bairro: optional,
  cidade: optional, uf: optional.transform(v => v.toUpperCase()).refine(v => !v || /^[A-Z]{2}$/.test(v)),
  cep: optional.transform(v => v.replace(/[.\-\s]/g, "")).refine(v => !v || /^\d{8}$/.test(v)),
});
export const employeeImportSchema = z.object({
  cnpj_empresa: digits(14), nome_completo: required.min(2).max(120), cpf: digits(11), rg: optional,
  naturalidade: required, nacionalidade: required, data_nascimento: date,
  sexo: optional.transform(v => sexValues[v.toLowerCase()] ?? (v || "not_informed")).pipe(z.enum(["female", "male", "other", "not_informed"])),
  funcao: required.min(2).max(120), data_admissao: optional.refine(v => !v || date.safeParse(v).success), posto_trabalho: required,
});
export function parseImportCsv(content: string, kind: ImportKind) {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const header = normalized.split("\n")[0] ?? "";
  const parsed = Papa.parse<ImportRow>(normalized, { delimiter: header.includes(";") ? ";" : ",", header: true, skipEmptyLines: "greedy", transformHeader: v => v.trim().toLowerCase(), transform: v => v.trim() });
  const requiredHeaders = kind === "companies" ? ["cnpj"] : employeeHeaders.filter(v => !["rg", "data_admissao", "sexo"].includes(v));
  if (parsed.errors.length || requiredHeaders.some(v => !parsed.meta.fields?.includes(v))) throw new Error("headers");
  if (!parsed.data.length || parsed.data.length > 500) throw new Error("count");
  const seen = new Set<string>();
  return parsed.data.map((data, index) => {
    const validation = (kind === "companies" ? companyImportSchema : employeeImportSchema).safeParse(data);
    const key = kind === "companies" ? data["cnpj"]?.replace(/\D/g, "") : `${data["cnpj_empresa"]?.replace(/\D/g, "")}:${data["cpf"]?.replace(/\D/g, "")}`;
    const duplicate = seen.has(key ?? "");
    seen.add(key ?? "");
    return { row: index + 2, data, issues: duplicate ? ["duplicate"] : validation.success ? [] : validation.error.issues.map(v => v.path.join(".")) };
  });
}
export function templateCsv(kind: ImportKind) {
  return "\uFEFF" + Papa.unparse({ fields: kind === "companies" ? companyHeaders : employeeHeaders, data: [] }, { delimiter: ";", newline: "\r\n" }) + "\r\n";
}
export function assertMasterImport(isMaster: boolean) {
  if (!isMaster) throw new Error("master_only");
}
export function downloadImportFile(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}