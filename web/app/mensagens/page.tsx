"use client";

import Link from "next/link";
import { useNetworkData } from "../rede/network-ui";

type Contact = { slug: string; name: string; activity: string };

export default function Page() {
  const { data, error } = useNetworkData<Contact[]>("/messages");
  return <main className="site-width profile-shell">
    <h1>Mensagens</h1>
    {error ? <p role="alert">{error} <Link href="/entrar">Entrar</Link></p> :
      !data ? <p role="status">A carregar…</p> : !data.length ?
        <p>Ainda não tem conversas. <Link href="/pessoas">Encontre uma pessoa para enviar uma mensagem.</Link></p> :
        <ul className="panel notification-list">{data.map((contact) => <li key={contact.slug}>
          <Link href={`/mensagens/${contact.slug}`}>{contact.name}</Link>
          <time dateTime={contact.activity}>{contact.activity.slice(0, 10)}</time>
        </li>)}</ul>}
  </main>;
}
