import { CommunityDirectory } from "../rede/network-ui";

export const metadata = { title: "Comunidades" };

export default function Page() {
  return <main className="site-width information-shell"><CommunityDirectory /></main>;
}
