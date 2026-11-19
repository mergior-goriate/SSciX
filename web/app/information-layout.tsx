import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type SectionLink = { href: string; label: string; icon: LucideIcon };

export default function InformationLayout({ title, description, icon: Icon, links, children }: {
  title: string;
  description?: string;
  icon: LucideIcon;
  links: SectionLink[];
  children: ReactNode;
}) {
  return <main className="site-width information-shell">
    <header className="information-hero">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <span className="information-hero-icon"><Icon size={34} aria-hidden="true" /></span>
    </header>
    <div className="information-layout">
      <nav className="panel information-index" aria-label="Navegação desta página">
        {links.map(({ href, label, icon: EntryIcon }) =>
          <Link key={href} href={href}><EntryIcon size={18} aria-hidden="true" />{label}</Link>)}
      </nav>
      <div className="information-content">{children}</div>
    </div>
  </main>;
}

export function InformationSection({ id, title, icon: Icon, children }: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return <section className="panel information-card" id={id} aria-labelledby={`${id}-titulo`}>
    <h2 id={`${id}-titulo`}><span><Icon size={20} aria-hidden="true" /></span>{title}</h2>
    {children}
  </section>;
}
