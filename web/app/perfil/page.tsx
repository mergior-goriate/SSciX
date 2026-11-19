import ProfileEditor from "./profile-editor";

export const metadata = { title: "Meu perfil", robots: { index: false, follow: false } };

export default function ProfilePage() {
  return <main className="site-width profile-shell own-profile-shell"><ProfileEditor /></main>;
}
