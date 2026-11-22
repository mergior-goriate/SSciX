import "../blogue.css";
import { BlogArticle } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artigo do blogue" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publisher = process.env.SSCIX_ADSENSE_PUBLISHER ?? "";
  const slot = process.env.SSCIX_ADSENSE_BLOG_SLOT ?? "";
  const configured = process.env.SSCIX_ADSENSE_ENABLED === "1" && /^ca-pub-\d{16}$/.test(publisher) && /^\d{1,16}$/.test(slot);
  return <main className="site-width information-shell network-stack">
    <BlogArticle id={id} publisher={configured ? publisher : ""} slot={configured ? slot : ""} />
  </main>;
}
