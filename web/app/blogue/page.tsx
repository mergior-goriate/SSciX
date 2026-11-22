import Link from "next/link";
import { BlogList } from "./ui";
import { ArrowUpRight } from "lucide-react";
import "./blogue.css";

export const metadata = { title: "Blogue oficial da SSciX" };

export default function Blog() {
  return <main className="site-width blog-shell">
    <header className="blog-hero">
      <div>
        <h1>Blogue oficial <span>da SSciX</span></h1>
        <p>A equipa publica novidades da rede, comunicados e oportunidades de participação.</p>
      </div>
      <nav className="blog-hero-links" aria-label="Opções do blogue">
        <Link href="/blogue/escrever">O meu blogue <ArrowUpRight size={18} aria-hidden="true" /></Link>
        <Link href="/blogue/politica">Política de publicação e monetização</Link>
      </nav>
    </header>
    <BlogList />
  </main>;
}
