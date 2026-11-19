import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topic } from "../network-ui";

export const metadata = { title: "Debate académico" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <main className="site-width information-shell discussion-shell">
    <nav aria-label="Percurso do debate" className="community-return">
      <Link href="/rede"><ArrowLeft size={18} aria-hidden="true" /> Feed académico</Link>
    </nav>
    <header className="information-hero">
      <h1>Debate</h1>
      <span className="information-hero-icon"><MessageCircle size={29} aria-hidden="true" /></span>
    </header>
    <Topic key={id} id={id} />
  </main>;
}
