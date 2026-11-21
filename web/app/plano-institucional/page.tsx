import { InstitutionalEnquiry } from "../commercial-ui";

export const metadata = { title: "Plano institucional", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width information-shell">
    <section className="panel form-stack">
      <h1>Plano institucional</h1>
      <p>Manifeste interesse num piloto para a sua universidade, associação científica ou centro de investigação.</p>
      <InstitutionalEnquiry />
    </section>
  </main>;
}
