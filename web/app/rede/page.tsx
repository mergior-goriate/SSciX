import { Feed } from "./network-ui";

export const metadata = { title: "Rede académica" };

export default function Page() {
  return <main className="site-width profile-shell network-shell">
    <h1>Rede académica</h1>
    <Feed />
  </main>;
}
