"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, BriefcaseBusiness, CircleHelp, Home, LogOut, Menu, MessageSquare, Settings, UserRound } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { api, message } from "./api-client";
import NotificationPopover from "./notificacoes/notification-popover";

const links = [
  ["/rede", "Início", Home],
  ["/mensagens", "Mensagens", MessageSquare],
  ["/perfil", "Perfil", UserRound],
] as const;

export default function Navigation() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", "POST");
      if (menu.current) menu.current.open = false;
      window.location.replace("/entrar");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <nav aria-label="Navegação principal" className="main-navigation">
    {links.map(([href, label, Icon]) => {
      const active = pathname === href || pathname.startsWith(href + "/");
      return <Fragment key={href}>
        {href === "/mensagens" && <NotificationPopover />}
        <Link href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined}>
          <Icon size={21} aria-hidden="true" />
        </Link>
      </Fragment>;
    })}
    <details ref={menu} className="navigation-menu">
      <summary aria-label="Abrir menu" title="Abrir menu"><Menu size={21} aria-hidden="true" /></summary>
      <div className="panel menu-popover">
        <Link href="/guardados" onClick={() => { if (menu.current) menu.current.open = false; }}><Bookmark size={18} aria-hidden="true" /> Guardados</Link>
        <Link href="/oportunidades" onClick={() => { if (menu.current) menu.current.open = false; }}><BriefcaseBusiness size={18} aria-hidden="true" /> Oportunidades</Link>
        <Link href="/definicoes" onClick={() => { if (menu.current) menu.current.open = false; }}><Settings size={18} aria-hidden="true" /> Definições</Link>
        <Link href="/ajuda" onClick={() => { if (menu.current) menu.current.open = false; }}><CircleHelp size={18} aria-hidden="true" /> Centro de ajuda</Link>
        <button type="button" onClick={logout} disabled={busy}><LogOut size={18} aria-hidden="true" /> Sair</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  </nav>;
}
