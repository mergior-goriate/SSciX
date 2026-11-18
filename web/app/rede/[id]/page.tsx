import { notFound } from "next/navigation";
import { Topic } from "../network-ui";

export const metadata = { title: "Debate académico" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <main className="site-width profile-shell network-shell"><h1>Debate</h1><Topic key={id} id={id} /></main>;
}
