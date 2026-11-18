"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bookmark, CircleHelp, Home, LogOut, Menu, MessageSquare, Settings, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { api, message } from "./api-client";

const links = [
  ["/rede", "Início", Home],
  ["/notificacoes", "Notificações", Bell],
  ["/mensagens", "Mensagens", MessageSquare],
  ["/perfil", "Perfil", UserRound],
] as const;

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", "POST");
      if (menu.current) menu.current.open = false;
      router.replace("/entrar");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <nav aria-label="Navegação principal" className="main-navigation">
    {links.map(([href, label, Icon]) => {
      const active = pathname === href || pathname.startsWith(href + "/");
      return <Link key={href} href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined}>
        <Icon size={21} aria-hidden="true" />
      </Link>;
    })}
    <details ref={menu} className="navigation-menu">
      <summary aria-label="Abrir menu" title="Abrir menu"><Menu size={21} aria-hidden="true" /></summary>
      <div className="panel menu-popover">
        <Link href="/guardados" onClick={() => { if (menu.current) menu.current.open = false; }}><Bookmark size={18} aria-hidden="true" /> Guardados</Link>
        <Link href="/definicoes" onClick={() => { if (menu.current) menu.current.open = false; }}><Settings size={18} aria-hidden="true" /> Definições</Link>
        <Link href="/ajuda" onClick={() => { if (menu.current) menu.current.open = false; }}><CircleHelp size={18} aria-hidden="true" /> Centro de ajuda</Link>
        <button type="button" onClick={logout} disabled={busy}><LogOut size={18} aria-hidden="true" /> Sair</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  </nav>;
}
