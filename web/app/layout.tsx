import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";
import "./styles.css";
import "./visual-identity.css";
import Navigation from "./navigation";
import UsageTracker from "./usage-tracker";
import { themeInitializationScript } from "./theme";

export const metadata: Metadata = {
  title: { default: "SSciX | Rede académica", template: "%s | SSciX" },
  description: "Rede académica do Sussurros do Saber.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-MZ" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} /></head>
      <body>
        <UsageTracker />
        <header className="site-header">
          <div className="site-width header-inner">
            <div className="header-brand-search">
              <Link href="/rede" className="wordmark" aria-label="SSciX, Feed académico">
                <span className="mark" aria-hidden="true"><i /><i /><i /></span>
                <span>SSci<span className="accent">X</span></span>
              </Link>
              <form className="header-search" action="/pessoas" role="search" aria-label="Pesquisa na SSciX">
                <button type="submit" aria-label="Pesquisar"><Search size={18} aria-hidden="true" /></button>
                <input type="search" name="q" aria-label="Pesquisar na SSciX" placeholder="Pesquisar na SSciX" maxLength={100} />
              </form>
            </div>
            <Navigation />
          </div>
        </header>
        {children}
        <footer className="site-width site-footer">
          <nav aria-label="Ligações do rodapé">
            <Link href="/ajuda">Centro de ajuda</Link>
            <Link href="/guias/revisao-de-literatura">Guia de revisão de literatura</Link>
            <Link href="/ajuda#comunidades">Políticas das comunidades</Link>
            <Link href="/termos#privacidade">Privacidade</Link>
            <Link href="/ajuda#acessibilidade">Acessibilidade</Link>
            <Link href="/ajuda#recomendacoes">Visibilidade das recomendações</Link>
            <Link href="/termos">Termos de utilização</Link>
          </nav>
          <p className="footer-copyright"><strong>SSciX</strong> <span>Sussurros do Saber © 2026</span></p>
        </footer>
      </body>
    </html>
  );
}
