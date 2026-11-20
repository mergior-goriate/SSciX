import { Feed } from "../rede/network-ui";
import NetworkSideNav from "../rede/network-sidenav";

export const metadata = { title: "Oportunidades académicas", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width profile-shell feed-shell">
    <div className="network-layout">
      <NetworkSideNav active="/oportunidades" />
      <section className="network-main" aria-labelledby="opportunities-title">
        <header className="feed-masthead"><h1 id="opportunities-title">Oportunidades académicas</h1></header>
        <Feed opportunities />
      </section>
    </div>
  </main>;
}
