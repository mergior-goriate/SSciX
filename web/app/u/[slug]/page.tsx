import Link from "next/link";
import { Link as LinkIcon, MessageSquare } from "lucide-react";
import { siFacebook, siInstagram, siX } from "simple-icons";
import Avatar from "../../avatar";
import { ResearcherDiscovery } from "../../rede/network-ui";
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

  const affiliations = details.filter(([key]) => key !== "orcid" && profile[key]);
  const milestones = trajectory.filter(([field]) => profile[field]);
  const hasTrajectory = Boolean(profile.biography || milestones.length);

  const socialPaths = { Facebook: siFacebook.path, Instagram: siInstagram.path, X: siX.path };

  return (
    <main className="site-width profile-shell scholar-shell">
      <article className="panel scholar-header">
        <div className="scholar-cover" aria-hidden="true" />
        <div className="scholar-identity">
          <Avatar name={profile.name} photo={profile.photo} className="initials" />
          <div>
            <h1>{profile.name}</h1>
            <p className="muted">{[roles[profile.academic_role], profile.institution].filter(Boolean).join(" · ")}</p>
            {profile.orcid && <a className="icon-action" href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noopener noreferrer">
              <span className="orcid-mark" aria-hidden="true">iD</span> ORCID {profile.orcid}
            </a>}
          </div>
          <div className="scholar-actions">
            <FollowButton key={profile.slug} slug={profile.slug} showCounts />
            <Link className="secondary icon-action" href={`/mensagens/${profile.slug}`}>
              <MessageSquare size={17} aria-hidden="true" /> Enviar mensagem
            </Link>
          </div>
        </div>
      </article>
      <div className="scholar-grid">
        {(affiliations.length > 0 || profile.keywords.length > 0 || profile.social_links.length > 0) && (
          <section className="panel public-profile">
            <h2>Informação académica</h2>
            <dl>{affiliations.map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{profile[key]}</dd></div>
            ))}</dl>
            {profile.keywords.length > 0 && <div className="profile-keywords" aria-label="Temas de investigação">
              {profile.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>}
            {profile.social_links.length > 0 && <ul className="profile-social">{profile.social_links.map((link, index) => {
              const path = link.platform in socialPaths ? socialPaths[link.platform as keyof typeof socialPaths] : undefined;
              return <li key={index}><a className="icon-action" href={link.url} target="_blank" rel="noopener noreferrer">
                {path ? <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={path} /></svg>
                  : link.platform === "LinkedIn" ? <span className="linkedin-mark" aria-hidden="true">in</span>
                    : <LinkIcon size={17} aria-hidden="true" />}{link.platform}
              </a></li>;
            })}</ul>}
          </section>
        )}
        {hasTrajectory && (
          <section className="panel scholar-trajectory">
            <h2>Trajectória académica</h2>
            {profile.biography && <section><h3>Sobre mim</h3><p className="biography">{profile.biography}</p></section>}
            {milestones.map(([field, label]) => (
              <section key={field}>
                <h3>{label}</h3>
                <p className="biography">{profile[field]}</p>
              </section>
            ))}
          </section>
        )}
      </div>
      <ResearcherDiscovery similarTo={profile.slug} />
    </main>
  );
}
