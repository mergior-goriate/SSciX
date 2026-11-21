import { PersonalActivity } from "../academic-ui";

export const metadata = { title: "A minha actividade", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width information-shell"><h1>A minha actividade</h1><PersonalActivity /></main>;
}
