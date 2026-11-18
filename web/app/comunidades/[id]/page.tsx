import { notFound } from "next/navigation";
import { CommunityPage } from "../../rede/network-ui";

export const metadata = { title: "Comunidade académica" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <main className="site-width profile-shell network-shell"><CommunityPage key={id} id={id} /></main>;
}
