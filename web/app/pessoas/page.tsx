import { fetchMemberApi } from "../../member-api";
import { Search, Users } from "lucide-react";
import FollowButton from "../u/[slug]/follow-button";
import Avatar from "../avatar";
import Link from "next/link";

export const metadata = { title: "Encontrar pessoas" };

type Entry = {
  slug: string;
  name: string;
  institution: string;
  specialization: string;
  photo: string;
  has_cover: boolean;
};

const PAGE_SIZE = 20;

export default async function PeoplePage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[]; institution?: string | string[]; area?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const institution = typeof params.institution === "string" ? params.institution.trim().slice(0, 160) : "";
  const area = typeof params.area === "string" ? params.area.trim().slice(0, 160) : "";
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100_000 ? requestedPage : 1;
  const query = new URLSearchParams({ q, institution, area, offset: String((page - 1) * PAGE_SIZE) });
  const response = await fetchMemberApi(`/api/v1/profiles?${query}`).catch(() => null);
  const entries: Entry[] = response?.ok ? await response.json() : [];

  return (
    <main className="site-width information-shell">
      <header className="information-hero">
        <h1>Encontrar pessoas</h1>
        <span className="information-hero-icon"><Users size={32} aria-hidden="true" /></span>
      </header>
      <section className="people-card-directory">
        <form action="/pessoas" className="panel people-card-search">
          <label className="people-keyword">Nome, instituição ou área de investigação
            <input name="q" defaultValue={q} maxLength={100} type="search" />
          </label>
          <label>Instituição<input name="institution" defaultValue={institution} maxLength={160} /></label>
          <label>Área de investigação<input name="area" defaultValue={area} maxLength={160} /></label>
          <button className="primary" type="submit"><Search size={17} aria-hidden="true" /> Pesquisar</button>
        </form>
        {!response?.ok ? <p role="status">A pesquisa está temporariamente indisponível.</p> :
          entries.length === 0 ? <p role="status">Nenhum perfil público encontrado.</p> :
            <ul className="people-card-grid" aria-label="Perfis encontrados">
              {entries.slice(0, PAGE_SIZE).map((entry) => (
                <li className="panel people-card" key={entry.slug}>
                  <div className="people-card-cover" aria-hidden="true">
                    {entry.has_cover && <img className="profile-cover-image" src={`/api/v1/profiles/${entry.slug}/cover`} alt="" loading="lazy" />}
                  </div>
                  <div className="people-card-details">
                    <Link href={`/u/${entry.slug}`} className="people-card-profile">
                      <Avatar name={entry.name} photo={entry.photo} />
                      <strong>{entry.name}</strong>
                    </Link>
                    {entry.specialization && <p>{entry.specialization}</p>}
                    {entry.institution && <small>{entry.institution}</small>}
                    <div className="people-card-actions"><FollowButton slug={entry.slug} /></div>
                  </div>
                </li>
              ))}
            </ul>}
        <nav className="hero-actions" aria-label="Páginas de resultados">
          {page > 1 && <Link href={{ pathname: "/pessoas", query: { q, institution, area, page: page - 1 } }}>Anterior</Link>}
          {entries.length > PAGE_SIZE && page < 100_000 &&
            <Link href={{ pathname: "/pessoas", query: { q, institution, area, page: page + 1 } }}>Seguinte</Link>}
        </nav>
      </section>
    </main>
  );
}
