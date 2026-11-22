import { BlogWorkspace } from "../ui";

export const metadata = { title: "O meu blogue" };

export default function Page() {
  return <main className="site-width information-shell network-stack">
    <h1>O meu blogue</h1>
    <BlogWorkspace />
  </main>;
}
