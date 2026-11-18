import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";
import "./styles.css";
import Navigation from "./navigation";

export const metadata: Metadata = {
  title: { default: "SSciX | Rede académica", template: "%s | SSciX" },
  description: "Rede académica do Sussurros do Saber.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-MZ">
      <body>
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
          <span>SSciX · Scientific Social Connection</span>
          <Link href="/termos">Termos de utilização</Link>
        </footer>
      </body>
    </html>
  );
}
