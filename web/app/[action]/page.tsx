import { notFound } from "next/navigation";
import AuthForm from "../auth-form";
import { views, type View } from "../auth-views";

export async function generateMetadata({ params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return { title: Object.hasOwn(views, action) ? views[action as View].title : "Página indisponível",
    robots: { index: false, follow: false } };
}

export default async function AccountAction({ params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!Object.hasOwn(views, action)) notFound();
  return <main className="site-width auth-shell"><AuthForm key={action} view={action as View} /></main>;
}
