"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, message } from "../api-client";

type Participation = {
  joined: boolean;
  whatsapp: string;
  participants: { slug: string; name: string; whatsapp: string }[];
};

export default function ReadingParticipants({ postId }: { postId: string }) {
  const path = `/feed/${postId}/participants`;
  const [data, setData] = useState<Participation>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<Participation>(path).then((value) => {
      if (active) setData(value);
    }).catch((failure) => {
      if (active) setError(message(failure));
    });
    return () => { active = false; };
  }, [path]);

  async function update(method: "PUT" | "DELETE", whatsapp = "") {
    setBusy(true);
    setError("");
    try {
      await api(`${path}/me`, method, method === "PUT" ? { whatsapp } : undefined);
      setData(await api<Participation>(path));
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const whatsapp = String(new FormData(event.currentTarget).get("whatsapp") ?? "")
      .trim().replace(/[ +()-]/g, "");
    if (whatsapp && !/^[1-9][0-9]{6,14}$/.test(whatsapp)) {
      setError("Introduza o número internacional, com o indicativo do país.");
      return;
    }
    void update("PUT", whatsapp);
  }

  return <section className="panel form-stack reading-participation" aria-label="Participação na sessão de leitura">
    <h2>Participantes da sessão</h2>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!data && !error && <p role="status">A carregar participantes…</p>}
    {data && !data.joined && <>
      <p>Inscreva-se para aparecer na lista da sessão e ver os contactos que os outros participantes decidiram partilhar.</p>
      <button className="primary" type="button" disabled={busy} onClick={() => void update("PUT")}>Participar na sessão</button>
    </>}
    {data?.joined && <>
      {data.participants.length > 0 ? <ul className="reading-contacts">
        {data.participants.map(({ slug, name, whatsapp }) => <li key={slug}>
          <span>{name}</span>
          {whatsapp && <a className="secondary" href={`https://wa.me/${whatsapp}`}
            target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp com ${name}`}>WhatsApp</a>}
        </li>)}
      </ul> : <p>Ainda não há outros participantes.</p>}
      <form className="form-stack" onSubmit={save}>
        <label>Número de WhatsApp (opcional)
          <input key={data.whatsapp} name="whatsapp" type="tel" maxLength={24}
            defaultValue={data.whatsapp ? `+${data.whatsapp}` : ""} placeholder="+258 …" />
          <small>Ao guardar o número, permite que apenas os outros participantes da sessão o contactem no WhatsApp. Para retirar o contacto, apague o número e guarde novamente.</small>
        </label>
        <button className="secondary" type="submit" disabled={busy}>Guardar contacto</button>
      </form>
      <button className="secondary" type="button" disabled={busy} onClick={() => void update("DELETE")}>Sair da sessão</button>
    </>}
  </section>;
}
