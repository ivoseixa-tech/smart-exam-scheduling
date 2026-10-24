import { describe, expect, it } from "vitest";
import { assertMasterImport, employeeImportSchema, parseImportCsv, templateCsv } from "../lib/bulk-import";

describe("bulk registration imports", () => {
  it("permits only the master user", () => { expect(() => assertMasterImport(false)).toThrow("master_only"); expect(() => assertMasterImport(true)).not.toThrow(); });
  it("provides a fillable company template", () => { const csv = templateCsv("companies") + "12.345.678/0001-90;;;;;;;;;;;;;;\r\n"; expect(parseImportCsv(csv, "companies")[0]?.issues).toEqual([]); });
  it("provides a fillable employee template with optional RG and admission", () => { const csv = templateCsv("employees") + "12345678000190;Ana Silva;12345678901;;São Paulo;Brasileira;1990-03-15;feminino;Motorista;;Central\r\n"; const rows = parseImportCsv(csv, "employees"); expect(rows[0]?.issues).toEqual([]); expect(employeeImportSchema.parse(rows[0]?.data).sexo).toBe("female"); });
  it("rejects incomplete employee data", () => { expect(employeeImportSchema.safeParse({ cpf: "12345678901" }).success).toBe(false); });
  it("rejects invalid calendar dates", () => { const csv = templateCsv("employees") + "12345678000190;Ana Silva;12345678901;;SP;Brasileira;1990-02-31;female;Motorista;;Central"; expect(parseImportCsv(csv, "employees")[0]?.issues).toContain("data_nascimento"); });
  it("flags repeated CNPJs without discarding the first row", () => { const rows = parseImportCsv("cnpj\n12345678000190\n12345678000190", "companies"); expect(rows.map(r => r.issues)).toEqual([[], ["duplicate"]]); });
  it("flags repeated CPF only within the same company", () => { const csv = templateCsv("employees"); const row = "12345678000190;Ana Silva;12345678901;;SP;Brasileira;1990-03-15;female;Motorista;;Central"; expect(parseImportCsv(csv + row + "\n" + row.replace("12345678000190", "98765432000110"), "employees").every(r => !r.issues.length)).toBe(true); });
});