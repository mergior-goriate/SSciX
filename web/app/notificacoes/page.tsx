"use client";

import Link from "next/link";
import { useState } from "react";
import { api, message } from "../api-client";
import { useNetworkData } from "../rede/network-ui";

type Notice = { id: string; topic_id: string; author_name: string; created_at: string; read: boolean };

export default function Page() {
  const { data, error, refresh } = useNetworkData<Notice[]>("/notifications");
  const [failure, setFailure] = useState("");

  async function mark(id: string) {
    setFailure("");
    try {
      await api(`/notifications/${id}/read`, "PUT");
      refresh();
    } catch (err) {
      setFailure(message(err));
    }
  }

  return <main className="site-width profile-shell">
    <h1>Notificações</h1>
    {failure && <p role="alert">{failure}</p>}
    {error ? <p role="alert">{error} <Link href="/entrar">Entrar</Link></p> :
      !data ? <p role="status">A carregar…</p> : !data.length ? <p>Não tem notificações.</p> :
        <ul className="panel notification-list">{data.map((notice) => <li key={notice.id}>
          <div><Link href={`/rede/${notice.topic_id}`}>{notice.author_name} mencionou-o numa publicação ou comentário.</Link>
            <time className="muted" dateTime={notice.created_at}>{notice.created_at.slice(0, 10)}</time></div>
          {!notice.read && <button type="button" className="secondary" onClick={() => void mark(notice.id)}>Marcar como lida</button>}
        </li>)}</ul>}
  </main>;
}
