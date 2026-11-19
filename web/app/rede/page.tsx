import { CommunityHighlights, Feed, ResearcherDiscovery } from "./network-ui";
import NetworkSideNav from "./network-sidenav";

export const metadata = { title: "Rede académica" };

export default function Page() {
  return <main className="site-width profile-shell feed-shell">
    <div className="network-layout">
      <NetworkSideNav active="/rede" />
      <section className="network-main" aria-labelledby="feed-title" tabIndex={0}>
        <header className="feed-masthead"><h1 id="feed-title">Feed académico</h1></header>
        <Feed />
      </section>
      <aside className="network-context" aria-label="Descobrir na SSciX">
        <ResearcherDiscovery />
        <CommunityHighlights />
      </aside>
    </div>
  </main>;
}
