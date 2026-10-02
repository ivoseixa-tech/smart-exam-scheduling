import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "pt" | "en";

const dictionary = {
  pt: {
    dashboard: "Visão geral", companies: "Empresas", employees: "Funcionários", exams: "Exames", schedule: "Agenda",
    settings: "Configurações", signOut: "Sair", newAppointment: "Novo agendamento", newCompany: "Nova empresa",
    newEmployee: "Novo funcionário", newExam: "Novo exame", search: "Buscar", save: "Salvar", cancel: "Cancelar",
    pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada", active: "Ativo", inactive: "Inativo",
    upcoming: "Próximos atendimentos", today: "Hoje", thisWeek: "Esta semana", pendingCompanies: "Empresas pendentes",
    totalEmployees: "Funcionários ativos", welcome: "Bom trabalho", subtitle: "Acompanhe a operação de saúde ocupacional.",
  },
  en: {
    dashboard: "Overview", companies: "Companies", employees: "Employees", exams: "Exams", schedule: "Schedule",
    settings: "Settings", signOut: "Sign out", newAppointment: "New appointment", newCompany: "New company",
    newEmployee: "New employee", newExam: "New exam", search: "Search", save: "Save", cancel: "Cancel",
    pending: "Pending", approved: "Approved", rejected: "Rejected", active: "Active", inactive: "Inactive",
    upcoming: "Upcoming appointments", today: "Today", thisWeek: "This week", pendingCompanies: "Pending companies",
    totalEmployees: "Active employees", welcome: "Welcome back", subtitle: "Follow your occupational health operation.",
  },
} as const;

type TranslationKey = keyof typeof dictionary.pt;
type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("pt");
  useEffect(() => {
    const stored = window.localStorage.getItem("medagenda-language");
    if (stored === "pt" || stored === "en") setLanguage(stored);
  }, []);
  const value = useMemo(() => ({ language, setLanguage: (next: Language) => {
    setLanguage(next); window.localStorage.setItem("medagenda-language", next);
  }, t: (key: TranslationKey) => dictionary[language][key] }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is missing");
  return value;
}