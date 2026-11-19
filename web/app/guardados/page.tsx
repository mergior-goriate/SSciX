import { SavedPosts } from "../rede/network-ui";

export const metadata = { title: "Publicações guardadas", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width information-shell">
    <SavedPosts />
  </main>;
}
