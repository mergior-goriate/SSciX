"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, message } from "../../api-client";
import { useNetworkData } from "../../rede/network-ui";

type Conversation = {
  name: string;
  can_send: boolean;
  has_more: boolean;
  messages: { id: string; mine: boolean; body: string; created_at: string }[];
};

export default function Page() {
  const { slug } = useParams<{ slug: string }>();
  const [offset, setOffset] = useState(0);
  const path = `/messages/${encodeURIComponent(slug)}`;
  const { data, error, refresh } = useNetworkData<Conversation>(`${path}?offset=${offset}`);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setFailure("");
    try {
      await api(path, "POST", Object.fromEntries(new FormData(form)));
      form.reset();
      if (offset) setOffset(0);
      else refresh();
    } catch (err) {
      setFailure(message(err));
    } finally {
      setBusy(false);
    }
  }

  return <main className="site-width profile-shell">
    <p><Link href="/mensagens">Voltar às mensagens</Link></p>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">A carregar…</p> : <>
      <h1>{data.name}</h1>
      <section className="panel conversation">
        <div className="profile-actions">
          {data.has_more && <button className="secondary" onClick={() => setOffset(offset + 50)}>Mais antigas</button>}
          {offset > 0 && <button className="secondary" onClick={() => setOffset(offset - 50)}>Mais recentes</button>}
          <button className="secondary" onClick={refresh}>Actualizar</button>
        </div>
        <ol>{data.messages.map((entry) => <li key={entry.id} className={entry.mine ? "mine" : ""}>
          <strong>{entry.mine ? "Eu" : data.name}</strong><p className="biography">{entry.body}</p>
          <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("pt-MZ")}</time>
        </li>)}</ol>
        {!data.messages.length && <p>A conversa ainda não tem mensagens.</p>}
        {data.can_send && <form className="form-stack" onSubmit={send}>
          <label>Escrever mensagem<textarea name="body" rows={3} maxLength={2400} required /></label>
          <button className="primary" disabled={busy}>Enviar mensagem</button>
          {failure && <p className="notice error" role="alert">{failure}</p>}
        </form>}
      </section>
    </>}
  </main>;
}
