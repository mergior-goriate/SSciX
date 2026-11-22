import "../../blogue.css";
import Link from "next/link";
import { BlogList } from "../../ui";

export const metadata = { title: "Blogue do investigador" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="site-width information-shell network-stack">
    <h1>Blogue de <Link href={`/u/${encodeURIComponent(slug)}`}>{slug}</Link></h1>
    <BlogList slug={slug} />
  </main>;
}
