import { cache } from "react";
import { notFound } from "next/navigation";
import FollowButton from "./follow-button";
import { details, type Profile, roles, trajectory } from "../../profile-data";

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
  const affiliations = details.filter(([key]) => profile[key]);
  const milestones = trajectory.filter(([field]) => profile[field]);
  const hasTrajectory = Boolean(profile.biography || milestones.length);

  return (
    <main className="site-width profile-shell scholar-shell">
      <article className="panel scholar-header">
        <div className="scholar-cover" aria-hidden="true" />
        <div className="scholar-identity">
          <div className="initials" aria-hidden="true">{initials}</div>
          <div>
            <h1>{profile.name}</h1>
            <p className="muted">{[roles[profile.academic_role], profile.institution].filter(Boolean).join(" · ")}</p>
          </div>
          <FollowButton key={profile.slug} slug={profile.slug} />
        </div>
      </article>
      <div className="scholar-grid">
        {affiliations.length > 0 && (
          <section className="panel public-profile">
            <h2>Informação académica</h2>
            <dl>{affiliations.map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{profile[key]}</dd></div>
            ))}</dl>
          </section>
        )}
        {hasTrajectory && (
          <section className="panel scholar-trajectory">
            <h2>Trajectória académica</h2>
            {profile.biography && <p className="biography">{profile.biography}</p>}
            {milestones.map(([field, label]) => (
              <section key={field}>
                <h3>{label}</h3>
                <p className="biography">{profile[field]}</p>
              </section>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
