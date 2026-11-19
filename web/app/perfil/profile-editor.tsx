"use client";

import { BookOpen, ExternalLink, Eye, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { api, message } from "../api-client";
import { details, type Profile, roles, type SocialLink, trajectory } from "../profile-data";

import KeywordPicker from "../keyword-picker";
import { readImage } from "../media";
import { PhotoEditor, SocialEditor } from "./profile-media";

type MyProfile = Profile & { email: string };

export default function ProfileEditor() {
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfile>();
  const [counts, setCounts] = useState<{ followers: number; following_count: number }>();
  const [photo, setPhoto] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<{ text: string; error: boolean }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<MyProfile>("/profiles/me").then((result) => {
      if (active) {
        setProfile(result);
        setPhoto(result.photo);
        setKeywords(result.keywords);
        setLinks(result.social_links);
      }
    }).catch((error) => {
      if (!active) return;
      if (error.status === 401) router.replace("/entrar");
      else setLoadError(message(error));
    });
    api<{ followers: number; following_count: number }>("/profiles/me/counts").then((result) => {
      if (active) setCounts(result);
    }).catch(() => {});
    return () => { active = false; };
  }, [retry, router]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setStatus(undefined);
    try {
      await action();
    } catch (error) {
      setStatus({ text: message(error), error: true });
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { is_public, ...values } = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      setProfile(await api<MyProfile>("/profiles/me", "PUT", { ...values, photo, keywords, social_links: links, is_public: is_public === "on" }));
      setStatus({ text: "Perfil guardado.", error: false });
    });
  }

  async function changePhoto(file: File | null) {
    await run(async () => setPhoto(file ? await readImage(file, 260 * 1024) : ""));
  }

  if (loadError) return <section className="panel"><p role="alert">{loadError}</p>
    <button className="secondary" onClick={() => { setLoadError(""); setRetry(retry + 1); }}>Tentar novamente</button></section>;
  if (!profile) return <p role="status">A carregar o perfil…</p>;

  return <>
    <header className="panel own-profile-header">
      <div className="own-profile-cover" aria-hidden="true" />
      <div className="own-profile-identity">
        <PhotoEditor name={profile.name} photo={photo} change={(file) => void changePhoto(file)} />
        <div className="own-profile-details">
          <h1>Meu perfil</h1>
          <strong>{profile.name}</strong>
          <p className="muted">{profile.institution || profile.email}</p>
          {counts && <p className="follow-counts"><span>{counts.followers} Seguidores</span><span>{counts.following_count} A seguir</span></p>}
        </div>
        <div className="own-profile-actions">
          {profile.is_public && <Link className="secondary icon-action" href={`/u/${profile.slug}`}>
            <ExternalLink size={17} aria-hidden="true" /> Ver perfil público
          </Link>}
          <button className="secondary icon-action" disabled={busy} onClick={() => void run(async () => {
            await api("/auth/logout", "POST");
            window.location.replace("/entrar");
          })}><LogOut size={17} aria-hidden="true" /> Terminar sessão</button>
        </div>
      </div>
    </header>
    <div className="own-profile-grid">
      <nav className="panel own-profile-nav" aria-label="Secções do perfil">
        <a href="#informacao-academica"><UserRound size={18} aria-hidden="true" /> Informação académica</a>
        <a href="#trajectoria"><BookOpen size={18} aria-hidden="true" /> Trajectória e ligações</a>
        <a href="#visibilidade"><Eye size={18} aria-hidden="true" /> Visibilidade</a>
        <Link href="/definicoes"><Settings size={18} aria-hidden="true" /> Definições da conta</Link>
      </nav>
      <form className="own-profile-form" onSubmit={save}>
        <section className="panel" id="informacao-academica">
          <h2>Informação académica</h2>
          <div className="field-grid">
            <label>Nome completo<input name="name" required minLength={2} maxLength={120} defaultValue={profile.name} /></label>
            <label>Endereço público<input name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={profile.slug} /></label>
            <label>Função académica<select name="academic_role" defaultValue={profile.academic_role}>
              {Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></label>
            {details.map(([key, label, length]) => <label key={key}>{label}
              <input name={key} defaultValue={profile[key]} maxLength={length} />
              {key === "orcid" && <small>Formato 0000-0000-0000-000X.</small>}
            </label>)}
          </div>
          <label>Sobre mim<textarea name="biography" rows={5} maxLength={2000} defaultValue={profile.biography} /></label>
          <KeywordPicker value={keywords} setValue={setKeywords} />
        </section>
        <section className="panel" id="trajectoria">
          <h2>Trajectória e ligações</h2>
          {trajectory.map(([field, label]) => (
            <label key={field}>{label}<textarea name={field} rows={3} maxLength={2000} defaultValue={profile[field]} /></label>
          ))}
          <SocialEditor links={links} change={setLinks} />
        </section>
        <section className="panel" id="visibilidade">
          <h2>Visibilidade</h2>
          <label className="check"><input type="checkbox" name="is_public" defaultChecked={profile.is_public} />
            <span>Tornar o perfil público. O perfil e as suas publicações ficam visíveis na rede académica.</span>
          </label>
        </section>
        <div className="panel own-profile-save">
          {status && <p className={status.error ? "notice error" : "notice"} role={status.error ? "alert" : "status"}>{status.text}</p>}
          <button className="primary" disabled={busy}>Guardar perfil</button>
        </div>
      </form>
    </div>
  </>;
}
