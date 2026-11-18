"use client";

import Link from "next/link";
import { useState } from "react";
import { api, message } from "../api-client";
import Avatar from "../avatar";
import { useNetworkData } from "../rede/network-ui";

type Notice = {
  id: string; topic_id: string; author_name: string; author_photo?: string; created_at: string; read: boolean;
};

export default function NotificationList({ onNavigate }: { onNavigate?: () => void }) {
  const { data, error } = useNetworkData<Notice[]>("/notifications");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [failure, setFailure] = useState("");

  const isUnread = (notice: Notice) => !notice.read && !marked.includes(notice.id);
  const notices = unreadOnly ? data?.filter(isUnread) : data;

  async function mark(id: string) {
    setFailure("");
    setPending((ids) => [...ids, id]);
    try {
      await api(`/notifications/${id}/read`, "PUT");
      setMarked((ids) => [...ids, id]);
    } catch (err) {
      setFailure(message(err));
    } finally {
      setPending((ids) => ids.filter((value) => value !== id));
    }
  }

  return <>
    <div className="feed-filters notification-filters" role="group" aria-label="Filtrar notificações">
      <button type="button" className="secondary" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Todas</button>
      <button type="button" className="secondary" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Não lidas</button>
    </div>
    {failure && <p role="alert">{failure}</p>}
    {error ? <p role="alert">{error} <Link href="/entrar" onClick={onNavigate}>Entrar</Link></p> :
      !notices ? <p role="status">A carregar…</p> :
        !notices.length ? <p role="status">{unreadOnly ? "Não tem notificações por ler." : "Não tem notificações."}</p> :
          <ul className="notification-list notification-items">{notices.map((notice) => {
            const unread = isUnread(notice);
            return <li key={notice.id}>
              <div className="notification-entry">
                <Avatar name={notice.author_name} photo={notice.author_photo} />
                <div>
                  <Link href={`/rede/${notice.topic_id}`} onClick={onNavigate}>
                    <strong>{notice.author_name}</strong> mencionou-o numa publicação ou comentário.
                  </Link>
                  <time className="muted" dateTime={notice.created_at}>{notice.created_at.slice(0, 10)}</time>
                </div>
                {unread && <span className="notification-dot" role="img" aria-label="Não lida" />}
              </div>
              {unread && <button type="button" className="secondary" disabled={pending.includes(notice.id)}
                onClick={() => void mark(notice.id)}>Marcar como lida</button>}
            </li>;
          })}</ul>}
  </>;
}
