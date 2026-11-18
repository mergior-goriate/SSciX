import { Bookmark, House, Search, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { Feed, ResearcherDiscovery } from "./network-ui";

export const metadata = { title: "Rede académica" };

export default function Page() {
  return <main className="site-width profile-shell feed-shell">
    <div className="feed-grid">
      <nav className="panel feed-navigation" aria-label="Navegação da rede">
        <Link href="/rede" aria-current="page"><House size={18} aria-hidden="true" />Feed académico</Link>
        <Link href="/perfil"><UserRound size={18} aria-hidden="true" />Meu perfil</Link>
        <Link href="/pessoas"><Search size={18} aria-hidden="true" />Encontrar pessoas</Link>
        <Link href="/comunidades"><Users size={18} aria-hidden="true" />Comunidades</Link>
        <Link href="/guardados"><Bookmark size={18} aria-hidden="true" /> Guardados</Link>
      </nav>
      <section className="feed-main" aria-labelledby="feed-title">
        <header className="feed-masthead"><h1 id="feed-title">Feed académico</h1></header>
        <Feed />
      </section>
      <ResearcherDiscovery />
    </div>
  </main>;
}
