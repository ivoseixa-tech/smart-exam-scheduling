import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type AppointmentGuideData = {
  language: "pt" | "en";
  company: string;
  cnpj: string;
  companyAddress: string;
  employee: string;
  cpf: string;
  jobTitle: string;
  assessmentType: string;
  startsAt: string;
  location: string;
  locationAddress: string;
  locationPhone: string;
  instructions: string;
  exams: string[];
  notes: string;
};

export async function downloadAppointmentGuide(data: AppointmentGuideData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  const { height, width } = page.getSize();
  const teal = rgb(0.07, 0.42, 0.4);
  const ink = rgb(0.12, 0.18, 0.2);
  const muted = rgb(0.38, 0.43, 0.45);
  const line = rgb(0.86, 0.89, 0.89);
  const text = data.language === "pt" ? {
    title: "Guia de agendamento ocupacional", company: "EMPRESA", employee: "FUNCIONÁRIO",
    appointment: "AGENDAMENTO", exams: "EXAMES", instructions: "ORIENTAÇÕES",
    date: "Data e horário", location: "Local", type: "Tipo ocupacional", notes: "Observações",
    footer: "Apresente esta guia e um documento de identificação no atendimento.",
  } : {
    title: "Occupational appointment guide", company: "COMPANY", employee: "EMPLOYEE",
    appointment: "APPOINTMENT", exams: "EXAMS", instructions: "INSTRUCTIONS",
    date: "Date and time", location: "Location", type: "Occupational type", notes: "Notes",
    footer: "Present this guide and an identification document at the appointment.",
  };
  const safe = (value: string) => value.replace(/\s+/g, " ").trim();
  const wrap = (value: string, max = 82) => {
    const words = safe(value).split(" "); const lines: string[] = []; let current = "";
    for (const word of words) { const next = current ? `${current} ${word}` : word; if (next.length > max && current) { lines.push(current); current = word; } else current = next; }
    if (current) lines.push(current); return lines.length ? lines : ["—"];
  };
  page.drawRectangle({ x: 0, y: height - 118, width, height: 118, color: teal });
  page.drawText("MEDAGENDA", { x: 42, y: height - 45, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(text.title, { x: 42, y: height - 82, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`#${data.cpf.slice(-4)}-${new Date(data.startsAt).getTime().toString().slice(-6)}`, { x: 445, y: height - 45, size: 9, font: regular, color: rgb(0.88, 1, 0.98) });
  let y = height - 152;
  const section = (title: string) => { page.drawText(title, { x: 42, y, size: 9, font: bold, color: teal }); y -= 15; };
  const row = (label: string, value: string) => { page.drawText(label, { x: 42, y, size: 9, font: bold, color: muted }); const lines = wrap(value, 66); lines.forEach((item, index) => page.drawText(item, { x: 155, y: y - index * 13, size: 10, font: regular, color: ink })); y -= Math.max(24, lines.length * 13 + 6); };
  const divider = () => { page.drawLine({ start: { x: 42, y }, end: { x: width - 42, y }, thickness: 1, color: line }); y -= 24; };
  section(text.company); row(data.company, `${data.cnpj} · ${data.companyAddress}`); divider();
  section(text.employee); row(data.employee, `${data.cpf} · ${data.jobTitle}`); divider();
  section(text.appointment);
  row(text.date, new Date(data.startsAt).toLocaleString(data.language === "pt" ? "pt-BR" : "en-US", { dateStyle: "long", timeStyle: "short" }));
  row(text.type, data.assessmentType); row(text.location, `${data.location} · ${data.locationAddress}${data.locationPhone ? ` · ${data.locationPhone}` : ""}`); divider();
  section(text.exams); data.exams.forEach((exam) => { page.drawCircle({ x: 47, y: y + 3, size: 2.5, color: teal }); page.drawText(exam, { x: 58, y, size: 10, font: regular, color: ink }); y -= 18; }); y -= 6; divider();
  section(text.instructions); wrap(data.instructions || "—", 84).forEach((item) => { page.drawText(item, { x: 42, y, size: 10, font: regular, color: ink }); y -= 14; });
  if (data.notes) { y -= 12; row(text.notes, data.notes); }
  page.drawRectangle({ x: 0, y: 0, width, height: 54, color: rgb(0.95, 0.97, 0.97) });
  page.drawText(text.footer, { x: 42, y: 23, size: 9, font: regular, color: muted });
  const bytes = await pdf.save();
  const pdfBuffer = new Uint8Array(bytes.length);
  pdfBuffer.set(bytes);
  const blob = new Blob([pdfBuffer.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `guia-${safe(data.employee).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`; anchor.click(); URL.revokeObjectURL(url);
}