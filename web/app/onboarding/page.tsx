import PreferencesSetup from "./preferences-setup";

export const metadata = { title: "Preferências do feed" };

export default async function Page({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  return <PreferencesSetup editing={editar === "1"} />;
}
