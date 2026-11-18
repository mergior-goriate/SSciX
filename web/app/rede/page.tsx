import Link from "next/link";
import { Feed, ResearcherDiscovery } from "./network-ui";

export const metadata = { title: "Rede académica" };

export default function Page() {
  return <main className="site-width profile-shell feed-shell">
    <header className="feed-masthead">
      <h1>Rede académica</h1>
      <nav aria-label="Atalhos da rede">
        <Link href="/perfil">Meu perfil</Link>
        <Link href="/comunidades">Comunidades</Link>
      </nav>
    </header>
    <div className="feed-grid">
      <section aria-label="Publicações académicas"><Feed /></section>
      <ResearcherDiscovery />
    </div>
  </main>;
}
