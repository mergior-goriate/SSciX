import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleDiscussions } from "../../rede/network-ui";

export const metadata = { title: "Artigo científico" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <main className="site-width information-shell discussion-shell">
    <nav aria-label="Percurso do artigo" className="community-return">
      <Link href="/rede"><ArrowLeft size={18} aria-hidden="true" /> Feed académico</Link>
    </nav>
    <ArticleDiscussions key={id} id={id} />
  </main>;
}
