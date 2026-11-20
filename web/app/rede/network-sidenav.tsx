import { Bookmark, BriefcaseBusiness, House, Settings, UserRound, Users } from "lucide-react";
import Link from "next/link";
import FeedProfileCard from "./feed-profile-card";

const shortcuts = [
  ["/rede", "Feed académico", House],
  ["/perfil", "Meu perfil", UserRound],
  ["/comunidades", "Comunidades", Users],
  ["/oportunidades", "Oportunidades", BriefcaseBusiness],
  ["/guardados", "Guardados", Bookmark],
  ["/definicoes", "Definições", Settings],
] as const;

export default function NetworkSideNav({ active }: { active?: string }) {
  return <aside className="network-rail">
    {active === "/rede" ? <FeedProfileCard /> : <Link href="/perfil" className="panel rail-profile">
      <span className="feed-initials"><UserRound size={18} aria-hidden="true" /></span>
      <strong>Meu perfil</strong>
    </Link>}
    <nav className="feed-navigation" aria-label="Atalhos da rede">
      {shortcuts.filter(([href]) => href !== "/perfil").map(([href, label, Icon]) =>
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined}>
          <Icon size={17} aria-hidden="true" />{label}
        </Link>)}
    </nav>
  </aside>;
}
