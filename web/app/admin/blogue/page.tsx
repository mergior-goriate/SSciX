import { BlogWorkspace, Editorial } from "../../blogue/ui";

export const metadata = { title: "Gestão editorial dos blogues" };

export default function Page() {
  return <main className="site-width information-shell network-stack">
    <h1>Gestão editorial dos blogues</h1>
    <BlogWorkspace official />
    <Editorial />
  </main>;
}
