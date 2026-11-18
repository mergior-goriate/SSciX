import { SavedPosts } from "../rede/network-ui";

export const metadata = { title: "Publicações guardadas", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width profile-shell">
    <h1>Publicações guardadas</h1>
    <SavedPosts />
  </main>;
}
