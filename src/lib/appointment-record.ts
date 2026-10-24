import { z } from "zod";

export const employeeSnapshotSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  cpf: z.string().regex(/^\d{11}$/),
  rg: z.string().trim().max(30).nullable(),
  birthplace: z.string().trim().min(1).max(160),
  nationality: z.string().trim().min(1).max(160),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(["female", "male", "other", "not_informed"]),
  job_title: z.string().trim().min(1).max(200),
  occupational_function_id: z.string().uuid().nullable(),
  admission_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  workplace: z.string().trim().min(1).max(160),
});

export type EmployeeSnapshot = z.infer<typeof employeeSnapshotSchema>;
export type AppointmentRecord = {
  appointment_code: string;
  employee_snapshot: unknown;
  employees?: { full_name: string; cpf: string } | null;
  job_title: string | null;
};

export function appointmentIdentity(record: AppointmentRecord) {
  const snapshot = record.employee_snapshot;
  const fields = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  return {
    full_name: typeof fields["full_name"] === "string" ? fields["full_name"] : record.employees?.full_name ?? "",
    cpf: typeof fields["cpf"] === "string" ? fields["cpf"] : record.employees?.cpf ?? "",
    job_title: record.job_title ?? (typeof fields["job_title"] === "string" ? fields["job_title"] : ""),
  };
}

export function filterAppointmentHistory<T extends AppointmentRecord>(rows: T[], query: string, employeeId = "") {
  const text = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const digits = text.replace(/\D/g, "");
  return rows.filter(row => {
    if (employeeId && (row as T & { employee_id?: string }).employee_id !== employeeId) return false;
    if (!text) return true;
    const identity = appointmentIdentity(row);
    return identity.full_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(text)
      || Boolean(digits && /^[\d.\-\s]+$/.test(text) && identity.cpf.includes(digits))
      || row.appointment_code.toLowerCase().includes(text);
  });
}