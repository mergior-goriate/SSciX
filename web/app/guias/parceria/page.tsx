import Link from "next/link";
import { PartnerOffer } from "../../commercial-ui";

export const metadata = { title: "Formação de parceiros" };

export default function Page() {
  return <main className="site-width information-shell">
    <section className="panel form-stack">
      <h1>Formação de parceiros</h1>
      <PartnerOffer />
      <Link href="/guias/revisao-de-literatura">Voltar ao guia de revisão de literatura</Link>
    </section>
  </main>;
}
