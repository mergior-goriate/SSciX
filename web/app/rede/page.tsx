import { CommunityHighlights, Feed, ResearcherDiscovery } from "./network-ui";
import { StoryPanel } from "../academic-ui";
import NetworkSideNav from "./network-sidenav";

export const metadata = { title: "Rede académica" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  return <main className="site-width profile-shell feed-shell">
    <div className="network-layout">
      <NetworkSideNav active="/rede" />
      <section className="network-main" aria-labelledby="feed-title">
        <header className="feed-masthead"><h1 id="feed-title">Feed académico</h1></header>
        <StoryPanel />
        <Feed key={query} initialQuery={query} />
      </section>
      <aside className="network-context" aria-label="Descobrir na SSciX">
        <ResearcherDiscovery />
        <CommunityHighlights />
      </aside>
    </div>
  </main>;
}
