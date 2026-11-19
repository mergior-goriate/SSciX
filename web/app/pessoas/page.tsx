import { fetchMemberApi } from "../../member-api";
import { ArrowRight, Search, Users } from "lucide-react";
import Avatar from "../avatar";
import Link from "next/link";

export const metadata = { title: "Encontrar pessoas" };

type Entry = {
  slug: string;
  name: string;
  institution: string;
  specialization: string;
};

const PAGE_SIZE = 20;

export default async function PeoplePage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100_000 ? requestedPage : 1;
  const query = new URLSearchParams({ q, offset: String((page - 1) * PAGE_SIZE) });
  const response = await fetchMemberApi(`/api/v1/profiles?${query}`).catch(() => null);
  const entries: Entry[] = response?.ok ? await response.json() : [];

  return (
    <main className="site-width information-shell">
      <header className="information-hero">
        <h1>Encontrar pessoas</h1>
        <span className="information-hero-icon"><Users size={32} aria-hidden="true" /></span>
      </header>
      <section className="panel people-directory directory-workspace">
        <form action="/pessoas">
          <label htmlFor="people-query">Nome, instituição ou área de investigação</label>
          <input id="people-query" name="q" defaultValue={q} maxLength={100} type="search" />
          <button className="primary" type="submit"><Search size={17} aria-hidden="true" /> Pesquisar</button>
        </form>
        {!response?.ok ? <p role="status">A pesquisa está temporariamente indisponível.</p> :
          entries.length === 0 ? <p role="status">Nenhum perfil público encontrado.</p> :
            <ul>
              {entries.slice(0, PAGE_SIZE).map((entry) => (
                <li key={entry.slug}>
                  <Link href={`/u/${entry.slug}`}>
                    <Avatar name={entry.name} />
                    <span><strong>{entry.name}</strong>
                      {(entry.institution || entry.specialization) && <small>{[entry.institution, entry.specialization].filter(Boolean).join(" · ")}</small>}
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>}
        <nav className="hero-actions" aria-label="Páginas de resultados">
          {page > 1 && <Link href={{ pathname: "/pessoas", query: { q, page: page - 1 } }}>Anterior</Link>}
          {entries.length > PAGE_SIZE && page < 100_000 &&
            <Link href={{ pathname: "/pessoas", query: { q, page: page + 1 } }}>Seguinte</Link>}
        </nav>
      </section>
    </main>
  );
}
