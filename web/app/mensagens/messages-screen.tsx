"use client";

import ReportButton from "../report-button";
import { ArrowLeft, MessageSquare, MessageSquarePlus, RefreshCw, Search, Send, Smile } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, message } from "../api-client";
import Avatar from "../avatar";
import { useNetworkData } from "../rede/network-ui";

type Contact = { slug: string; name: string; photo: string; preview: string; activity: string };
type SuggestedContact = { slug: string; name: string; photo: string; institution: string };
type Entry = { id: string; mine: boolean; body: string; created_at: string };
type Conversation = {
  name: string; photo: string; public_profile: boolean; can_send: boolean; has_more: boolean; messages: Entry[];
};

const greetings = ["👋 Olá!", "Tudo bem?", "Vamos colaborar?"];
const emojis = ["👋", "😊", "👍", "👏", "💡", "🤝", "📚"];

function normalise(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function Suggestions({ contacts, query }: { contacts: Contact[]; query: string }) {
  const { data } = useNetworkData<SuggestedContact[]>("/profiles/discover/suggestions");
  const suggestions = data?.filter((person) =>
    !contacts.some((contact) => contact.slug === person.slug) && normalise(person.name).includes(query)).slice(0, 5);
  if (!suggestions?.length) return null;

  return <section className="message-suggestions">
    <h2>Sugestões</h2>
    <ul>{suggestions.map((person) => <li key={person.slug}>
      <Avatar name={person.name} photo={person.photo} />
      <div><strong>{person.name}</strong>{person.institution && <small>{person.institution}</small>}</div>
      <Link className="secondary" href={`/mensagens/${person.slug}`} aria-label={`Conversar com ${person.name}`}>Conversar</Link>
    </li>)}</ul>
  </section>;
}

function Inbox({ slug, version }: { slug?: string; version: number }) {
  const [search, setSearch] = useState("");
  const { data, error } = useNetworkData<Contact[]>("/messages", version);
  const query = normalise(search.trim());
  const visible = data?.filter((contact) => normalise(contact.name).includes(query));

  return <aside className="message-inbox" aria-labelledby="inbox-title">
    <header>
      <h1 id="inbox-title">Mensagens</h1>
      <Link className="secondary message-icon" href="/pessoas" aria-label="Nova conversa" title="Nova conversa">
        <MessageSquarePlus size={19} aria-hidden="true" />
      </Link>
    </header>
    <label className="message-search">
      <Search size={18} aria-hidden="true" />
      <input type="search" value={search} placeholder="Pesquisar conversas" aria-label="Pesquisar conversas"
        onChange={(event) => setSearch(event.target.value)} />
    </label>
    <div className="inbox-content">
      {error ? <p role="alert">{error} <Link href="/entrar">Entrar</Link></p> :
        !visible ? <p role="status">A carregar conversas…</p> :
          !visible.length ? <div className="message-empty">
            <MessageSquare size={26} aria-hidden="true" />
            <strong>{query ? "Nenhuma conversa encontrada." : "Ainda não tem conversas."}</strong>
            <Link href={query ? `/pessoas?q=${encodeURIComponent(search.trim())}` : "/pessoas"}>Encontrar pessoas</Link>
          </div> :
            <ul className="message-contacts">{visible.map((contact) => <li key={contact.slug}>
              <Link href={`/mensagens/${contact.slug}`} aria-current={slug === contact.slug ? "page" : undefined}>
                <Avatar name={contact.name} photo={contact.photo} />
                <div><strong>{contact.name}</strong><small>{contact.preview}</small></div>
                <time dateTime={contact.activity}>{contact.activity.slice(5, 10).split("-").reverse().join("/")}</time>
              </Link>
            </li>)}</ul>}
      {data && <Suggestions contacts={data} query={query} />}
    </div>
  </aside>;
}

function Thread({ slug, onSent }: { slug: string; onSent: () => void }) {
  const [offset, setOffset] = useState(0);
  const path = `/messages/${encodeURIComponent(slug)}`;
  const { data, error, refresh } = useNetworkData<Conversation>(`${path}?offset=${offset}`);
  const [body, setBody] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!offset && data && history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [data, offset]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    setFailure("");
    try {
      await api(path, "POST", { body: body.trim() });
      setBody("");
      setShowEmojis(false);
      if (offset) setOffset(0);
      else refresh();
      onSent();
    } catch (err) {
      setFailure(message(err));
    } finally {
      setBusy(false);
    }
  }

  return <section className="message-thread" aria-label="Conversa">
    <header className="thread-header">
      <Link className="secondary message-icon thread-back" href="/mensagens" aria-label="Voltar às mensagens">
        <ArrowLeft size={19} aria-hidden="true" />
      </Link>
      {data ? <><Avatar name={data.name} photo={data.photo} /><h2>{data.name}</h2></> : <h2>Conversa</h2>}
      <button className="secondary message-icon thread-refresh" type="button" onClick={refresh} aria-label="Actualizar conversa" title="Actualizar conversa">
        <RefreshCw size={17} aria-hidden="true" />
      </button>
    </header>
    <div className="conversation thread-history" ref={history}>
      {error ? <p role="alert">{error}</p> : !data ? <p role="status">A carregar conversa…</p> : <>
        {(data.has_more || offset > 0) && <div className="thread-pages">
          {data.has_more && <button className="secondary" onClick={() => setOffset(offset + 50)}>Mais antigas</button>}
          {offset > 0 && <button className="secondary" onClick={() => setOffset(offset - 50)}>Mais recentes</button>}
        </div>}
        {!data.messages.length && <div className="message-empty">
          <Avatar name={data.name} photo={data.photo} />
          <strong>{data.name}</strong>
          {data.public_profile && <Link href={`/u/${slug}`} className="secondary">Ver perfil</Link>}
          <p>A conversa ainda não tem mensagens.</p>
        </div>}
        <ol aria-label="Histórico de mensagens">{data.messages.map((entry) => <li key={entry.id} className={entry.mine ? "mine" : ""}>
          {!entry.mine && <ReportButton kind="message" id={entry.id} label="Denunciar mensagem" />}
          <p className="biography">{entry.body}</p>
          <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("pt-MZ")}</time>
        </li>)}</ol>
      </>}
    </div>
    {data?.can_send && <form className="thread-compose" onSubmit={send}>
      {!data.messages.length && <div className="thread-quick-replies" aria-label="Saudações sugeridas">{greetings.map((greeting) =>
        <button type="button" className="secondary" key={greeting} onClick={() => {
          setBody(greeting);
          field.current?.focus();
        }}>{greeting}</button>)}</div>}
      {showEmojis && <div className="thread-quick-replies" role="group" aria-label="Escolher emoji">{emojis.map((emoji) =>
        <button key={emoji} type="button" className="secondary" onClick={() => {
          setBody((value) => value.length + emoji.length <= 2400 ? value + emoji : value);
          field.current?.focus();
        }}>{emoji}</button>)}</div>}
      <div className="thread-input">
        <button type="button" className="secondary message-icon" aria-label="Emojis" aria-expanded={showEmojis}
          onClick={() => setShowEmojis(!showEmojis)}><Smile size={20} aria-hidden="true" /></button>
        <textarea ref={field} name="body" value={body} onChange={(event) => setBody(event.target.value)}
          aria-label="Escrever mensagem" placeholder="Escrever mensagem" rows={2} maxLength={2400} required />
        <button className="primary message-icon" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={busy || !body.trim()}>
          <Send size={19} aria-hidden="true" />
        </button>
      </div>
      {failure && <p className="notice error" role="alert">{failure}</p>}
    </form>}
  </section>;
}

export default function MessagesScreen({ slug }: { slug?: string }) {
  const [version, setVersion] = useState(0);
  return <main className={`site-width profile-shell messaging-shell${slug ? " has-thread" : ""}`}>
    <div className="messaging-layout">
      <Inbox slug={slug} version={version} />
      {slug ? <Thread key={slug} slug={slug} onSent={() => setVersion((value) => value + 1)} /> :
        <section className="message-thread message-thread-empty" aria-label="Conversa">
          <div className="message-empty"><MessageSquare size={32} aria-hidden="true" />
            <h2>Seleccione uma conversa</h2><p>Ou encontre uma pessoa para iniciar uma nova.</p>
          </div>
        </section>}
    </div>
  </main>;
}
