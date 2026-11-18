import { cache } from "react";
import { notFound } from "next/navigation";
import { details, type Profile, roles } from "../../profile-data";

const loadProfile = cache(async (slug: string): Promise<Profile> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 40) notFound();
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(new URL(`/api/v1/profiles/${slug}`, base), { cache: "no-store" });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("O serviço de perfis está indisponível.");
  return response.json();
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await loadProfile((await params).slug);
  return { title: profile.name, description: "Perfil académico na SSciX", robots: { index: false, follow: true } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await loadProfile((await params).slug);
  const initials = profile.name.split(/\s+/).slice(0, 2).map((part) => [...part][0]).join("");
  return (
    <main className="site-width profile-shell">
      <article className="panel public-profile">
        <div className="public-heading">
          <div className="initials" aria-hidden="true">{initials}</div>
          <div><h1>{profile.name}</h1><p className="muted">{roles[profile.academic_role]}</p></div>
        </div>
        {profile.biography && <p className="biography">{profile.biography}</p>}
        <dl>{details.filter(([key]) => profile[key]).map(([key, label]) => (
          <div key={key}><dt>{label}</dt><dd>{profile[key]}</dd></div>
        ))}</dl>
      </article>
    </main>
  );
}
