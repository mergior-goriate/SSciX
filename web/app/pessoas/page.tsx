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
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  const url = new URL("/api/v1/profiles", base);
  url.searchParams.set("q", q);
  url.searchParams.set("offset", String((page - 1) * PAGE_SIZE));
  const response = await fetch(url, { cache: "no-store" }).catch(() => null);
  const entries: Entry[] = response?.ok ? await response.json() : [];

  return (
    <main className="site-width profile-shell">
      <section className="panel people-directory">
        <h1>Encontrar pessoas</h1>
        <form action="/pessoas">
          <label htmlFor="people-query">Nome, instituição ou área de investigação</label>
          <input id="people-query" name="q" defaultValue={q} maxLength={100} type="search" />
          <button className="primary" type="submit">Pesquisar</button>
        </form>
        {!response?.ok ? <p role="status">A pesquisa está temporariamente indisponível.</p> :
          entries.length === 0 ? <p role="status">Nenhum perfil público encontrado.</p> :
            <ul>
              {entries.slice(0, PAGE_SIZE).map((entry) => (
                <li key={entry.slug}>
                  <Link href={`/u/${entry.slug}`}>{entry.name}</Link>
                  {(entry.institution || entry.specialization) &&
                    <p className="muted">{[entry.institution, entry.specialization].filter(Boolean).join(" · ")}</p>}
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
