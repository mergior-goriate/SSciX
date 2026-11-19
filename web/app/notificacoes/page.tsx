import { Bell } from "lucide-react";
import NotificationList from "./notification-list";

export const metadata = { title: "Notificações", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width information-shell">
    <header className="information-hero">
      <h1>Notificações</h1>
      <span className="information-hero-icon"><Bell size={32} aria-hidden="true" /></span>
    </header>
    <section className="panel notification-workspace">
      <NotificationList />
    </section>
  </main>;
}
