"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { api } from "./api-client";

const pages: Record<string, string> = {
  rede: "feed", comunidades: "communities", u: "profile", perfil: "profile",
  pessoas: "directory", mensagens: "messages", notificacoes: "notifications", guardados: "saved",
  oportunidades: "opportunities", definicoes: "settings", onboarding: "onboarding",
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default function UsageTracker() {
  const pathname = usePathname();
  const last = useRef("");
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    const [, section, target] = pathname.split("/");
    if (!Object.hasOwn(pages, section)) return;
    const detail = target && uuid.test(target) && (section === "rede" || section === "comunidades");
    const page = detail ? (section === "rede" ? "post" : "community") : pages[section];
    void api("/events/page", "POST", { id: crypto.randomUUID(), page, ...(detail ? { target } : {}) }).catch(() => {});
  }, [pathname]);
  return null;
}
