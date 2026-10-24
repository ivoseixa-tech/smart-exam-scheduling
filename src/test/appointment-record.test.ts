import { describe, it, expect } from "vitest";
import { appointmentIdentity, employeeSnapshotSchema, filterAppointmentHistory } from "../lib/appointment-record";

const rows = [
  { appointment_code: "AG-001", employee_id: "worker-1", employee_snapshot: { full_name: "José Silva", cpf: "12345678901" }, employees: { full_name: "Changed registry", cpf: "99999999999" }, job_title: "Motorista", status: "completed" },
  { appointment_code: "AG-002", employee_id: "worker-1", employee_snapshot: { full_name: "José Silva", cpf: "12345678901" }, job_title: "Supervisor", status: "cancelled" },
  { appointment_code: "AG-003", employee_id: "worker-2", employee_snapshot: { full_name: "Ana Lima", cpf: "98765432100" }, job_title: "Enfermeira", status: "scheduled" },
];

describe("appointment history rules", () => {
  it("shows every appointment, including completed and cancelled ones", () => { expect(filterAppointmentHistory(rows, "")).toHaveLength(3); });
  it("finds a worker's appointments by name", () => { expect(filterAppointmentHistory(rows, "jose").map(r => r.appointment_code)).toEqual(["AG-001", "AG-002"]); });
  it("finds all appointments by formatted CPF", () => { expect(filterAppointmentHistory(rows, "123.456.789-01")).toHaveLength(2); });
  it("filters an individual worker without losing old appointments", () => { expect(filterAppointmentHistory(rows, "", "worker-2").map(r => r.appointment_code)).toEqual(["AG-003"]); });
  it("keeps the appointment's edited details independent of the registry", () => { const row = rows[0]; if (!row) throw new Error("Missing fixture"); expect(appointmentIdentity(row)).toEqual({ full_name: "José Silva", cpf: "12345678901", job_title: "Motorista" }); });
  it("validates edited appointment fields", () => { expect(employeeSnapshotSchema.safeParse({ full_name: "" }).success).toBe(false); });
});