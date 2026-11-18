"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, message } from "../api-client";
import KeywordPicker from "../keyword-picker";

export default function Page() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/profiles/me/keywords", "PUT", { keywords });
      router.replace("/perfil");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <main className="site-width profile-shell">
    <section className="panel form-stack">
      <p className="notice" role="status">Email confirmado.</p>
      <h1>Escolha os seus temas</h1>
      <p>Use os seus interesses para descobrir investigadores na SSciX.</p>
      <form className="form-stack" onSubmit={save}>
        <KeywordPicker value={keywords} setValue={setKeywords} />
        <button className="primary" disabled={busy}>{keywords.length ? "Guardar e continuar" : "Continuar sem temas"}</button>
        {error && <p className="notice error" role="alert">{error}</p>}
      </form>
    </section>
  </main>;
}
