import { CommunityDirectory } from "../rede/network-ui";

export const metadata = { title: "Comunidades" };

export default function Page() {
  return <main className="site-width profile-shell network-shell"><h1>Comunidades</h1><CommunityDirectory /></main>;
}
