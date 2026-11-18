"use client";

import { Bell, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import NotificationList from "./notification-list";

const panelId = "header-notifications";

export default function NotificationPopover() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => panel.current?.hidePopover();

  return <>
    <button className="notification-trigger" type="button" aria-label="Notificações" title="Notificações"
      popoverTarget={panelId} aria-expanded={open} aria-controls={panelId}>
      <Bell size={21} aria-hidden="true" />
    </button>
    <div ref={panel} id={panelId} className="panel notification-popover" popover="auto"
      role="region" aria-labelledby="header-notifications-title"
      onToggle={(event) => setOpen(event.currentTarget.matches(":popover-open"))}>
      <header>
        <h2 id="header-notifications-title">Notificações</h2>
        <button type="button" popoverTarget={panelId} popoverTargetAction="hide" aria-label="Fechar notificações">
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      {open && <NotificationList onNavigate={close} />}
      <Link href="/notificacoes" onClick={close}>Ver tudo</Link>
    </div>
  </>;
}
