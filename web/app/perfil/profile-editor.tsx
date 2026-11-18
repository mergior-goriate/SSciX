"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { api, message } from "../api-client";
import { details, type Profile, roles } from "../profile-data";

type MyProfile = Profile & { email: string };

export default function ProfileEditor() {
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfile>();
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<{ text: string; error: boolean }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<MyProfile>("/profiles/me").then((result) => {
      if (active) setProfile(result);
    }).catch((error) => {
      if (!active) return;
      if (error.status === 401) router.replace("/entrar");
      else setLoadError(message(error));
    });
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
      setProfile(await api<MyProfile>("/profiles/me", "PUT", { ...values, is_public: is_public === "on" }));
      setStatus({ text: "Perfil guardado.", error: false });
    });
  }

  async function closeAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      await api("/auth/account", "DELETE", data);
      router.replace("/");
    });
  }

  if (loadError) return <section className="panel"><p role="alert">{loadError}</p>
    <button className="secondary" onClick={() => { setLoadError(""); setRetry(retry + 1); }}>Tentar novamente</button></section>;
  if (!profile) return <p role="status">A carregar o perfil…</p>;

  return <>
    <header className="profile-heading">
      <div><h1>Meu perfil</h1><p className="muted">{profile.email}</p></div>
      <button className="secondary" disabled={busy} onClick={() => void run(async () => {
        await api("/auth/logout", "POST");
        router.replace("/entrar");
      })}>Terminar sessão</button>
    </header>
    <div className="profile-grid">
      <section className="panel">
        <h2>Informação académica</h2>
        <form className="form-stack" onSubmit={save}>
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
          <label>Biografia académica<textarea name="biography" rows={5} maxLength={2000} defaultValue={profile.biography} /></label>
          <label className="check"><input type="checkbox" name="is_public" defaultChecked={profile.is_public} />
            <span>Tornar o perfil público. Os campos acima ficam visíveis a quem aceder ao endereço.</span>
          </label>
          <div className="profile-actions"><button className="primary" disabled={busy}>Guardar perfil</button>
            {profile.is_public && <Link href={`/u/${profile.slug}`}>Ver perfil público ↗</Link>}</div>
          {status && <p className={status.error ? "notice error" : "notice"} role={status.error ? "alert" : "status"}>{status.text}</p>}
        </form>
      </section>
      <aside className="panel account-panel">
        <h2>Conta</h2>
        <p className="muted">A eliminação remove o perfil e termina todas as sessões.</p>
        <details>
          <summary>Eliminar conta</summary>
          <form className="form-stack" onSubmit={closeAccount}>
            <label>Confirme a palavra-passe<input name="password" type="password" required maxLength={128} autoComplete="current-password" /></label>
            <button className="danger" disabled={busy}>Eliminar definitivamente</button>
          </form>
        </details>
      </aside>
    </div>
  </>;
}
