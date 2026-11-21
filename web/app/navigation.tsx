"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, BriefcaseBusiness, CircleHelp, History, Home, Shield, LogOut, Menu, MessageSquare, Settings, UserRound, UsersRound } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { api, message } from "./api-client";
import NotificationPopover from "./notificacoes/notification-popover";

const links = [
  ["/rede", "Início", Home],
  ["/mensagens", "Mensagens", MessageSquare],
  ["/perfil", "Perfil", UserRound],
  ["/pessoas", "Networking", UsersRound],
] as const;

export default function Navigation() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    api("/admin/access").then(() => { if (active) setAdmin(true); })
      .catch(() => { if (active) setAdmin(false); });
    return () => { active = false; };
  }, [pathname]);

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
        <Link href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined}
          className={href === "/pessoas" ? "navigation-networking" : undefined}>
          <Icon size={21} aria-hidden="true" />
          {href === "/pessoas" && <span>{label}</span>}
        </Link>
      </Fragment>;
    })}
    <details ref={menu} className="navigation-menu">
      <summary aria-label="Abrir menu" title="Abrir menu"><Menu size={21} aria-hidden="true" /></summary>
      <div className="panel menu-popover">
        {admin && <Link href="/admin" onClick={() => { if (menu.current) menu.current.open = false; }}>
          <Shield size={18} aria-hidden="true" /> Administração
        </Link>}
        <Link href="/actividade" onClick={() => { if (menu.current) menu.current.open = false; }}><History size={18} aria-hidden="true" /> A minha actividade</Link>
        <Link href="/guardados" onClick={() => { if (menu.current) menu.current.open = false; }}><Bookmark size={18} aria-hidden="true" /> Guardados</Link>
        <Link href="/plano-institucional" onClick={() => { if (menu.current) menu.current.open = false; }}><BriefcaseBusiness size={18} aria-hidden="true" /> Plano institucional</Link>
        <Link href="/oportunidades" onClick={() => { if (menu.current) menu.current.open = false; }}><BriefcaseBusiness size={18} aria-hidden="true" /> Oportunidades</Link>
        <Link href="/definicoes" onClick={() => { if (menu.current) menu.current.open = false; }}><Settings size={18} aria-hidden="true" /> Definições</Link>
        <Link href="/ajuda" onClick={() => { if (menu.current) menu.current.open = false; }}><CircleHelp size={18} aria-hidden="true" /> Centro de ajuda</Link>
        <button type="button" onClick={logout} disabled={busy}><LogOut size={18} aria-hidden="true" /> Sair</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  </nav>;
}
