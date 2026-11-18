import { Feed, ResearcherDiscovery } from "./network-ui";

export const metadata = { title: "Rede académica" };

export default function Page() {
  return <main className="site-width profile-shell feed-shell">
    <header className="feed-masthead">
      <h1>Feed académico</h1>
    </header>
    <div className="feed-grid">
      <section aria-label="Publicações académicas"><Feed /></section>
      <ResearcherDiscovery />
    </div>
  </main>;
}
