import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/auth" }); },
  head: () => ({ meta: [
    { title: "MedAgenda Ocupacional" }, { name: "description", content: "Gestão segura de exames e agendamentos ocupacionais." },
    { property: "og:title", content: "MedAgenda Ocupacional" }, { property: "og:description", content: "Gestão segura de exames e agendamentos ocupacionais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}),
});
