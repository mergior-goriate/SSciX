import { CommercialAdmin } from "../../commercial-ui";

export const metadata = { title: "Gestão comercial", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width information-shell"><h1>Gestão comercial</h1><CommercialAdmin /></main>;
}
