import type { Metadata } from "next";
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
            <Link href="/" className="wordmark" aria-label="SSciX, início">
              <span className="mark" aria-hidden="true"><i /><i /><i /></span>
              <span>SSci<span className="accent">X</span></span>
            </Link>
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
