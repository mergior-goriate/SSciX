import Link from "next/link";
import { BlogList } from "./ui";
import { categories } from "./categories";

export const metadata = { title: "Blogue oficial da SSciX" };

export default function Blog() {
  return <main className="site-width information-shell network-stack">
    <header className="information-hero">
      <h1>Blogue oficial da SSciX</h1>
      <p>A equipa publica novidades da rede, comunicados e oportunidades de participação.</p>
    </header>
    <nav className="profile-actions" aria-label="Opções do blogue">
      <Link href="/blogue/escrever">O meu blogue</Link>
      <Link href="/blogue/politica">Política de publicação e monetização</Link>
    </nav>
    {Object.entries(categories).filter(([key]) => key !== "investigacao").map(([key, label]) =>
      <section className="network-stack" key={key}><h2>{label}</h2><BlogList category={key} /></section>)}
  </main>;
}
