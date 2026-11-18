import MessagesScreen from "../messages-screen";

export const metadata = { title: "Conversa", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MessagesScreen slug={slug} />;
}
