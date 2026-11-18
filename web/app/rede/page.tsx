import Link from "next/link";
import { Feed, ResearcherDiscovery } from "./network-ui";

export const metadata = { title: "Rede académica" };

export default function Page() {
  return <main className="site-width profile-shell feed-shell">
    <div className="feed-grid">
      <nav className="panel feed-navigation" aria-label="Navegação da rede">
        <Link href="/rede" aria-current="page">Feed académico</Link>
        <Link href="/perfil">Meu perfil</Link>
        <Link href="/pessoas">Encontrar pessoas</Link>
        <Link href="/comunidades">Comunidades</Link>
      </nav>
      <section className="feed-main" aria-labelledby="feed-title">
        <header className="feed-masthead"><h1 id="feed-title">Feed académico</h1></header>
        <Feed />
      </section>
      <ResearcherDiscovery />
    </div>
  </main>;
}
