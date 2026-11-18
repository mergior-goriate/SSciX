import NotificationList from "./notification-list";

export const metadata = { title: "Notificações", robots: { index: false, follow: false } };

export default function Page() {
  return <main className="site-width profile-shell">
    <h1>Notificações</h1>
    <section className="panel">
      <NotificationList />
    </section>
  </main>;
}
