"use client";

import Link from "next/link";
import Script from "next/script";
import { useRef, useState, type FormEvent } from "react";
import { api, message } from "../api-client";
import { readImage } from "../media";
import { useNetworkData } from "../use-network-data";

import { categories } from "./categories";

type Entry = {
  id: string; title: string; body: string; cover: string; category: keyof typeof categories;
  author: string; slug: string; official: boolean; visibility: "draft" | "public" | "members";
  published_at: string | null; corrections: { date: string; note: string }[];
  ads: boolean; hidden: boolean; moderation_reason?: string;
};
type Result<T> = {items: T[]; more: boolean};
type Report = {id: string; entry_id: string; reason: string};

function Feedback({error, loading}: {error: string; loading: boolean}) {
  return error ? <p className="notice error" role="alert">{error}</p>
    : loading ? <p role="status">A carregar…</p> : null;
}

function Pages({offset, more, setOffset}: {offset: number; more?: boolean; setOffset: (n: number) => void}) {
  if (!offset && !more) return null;
  return <nav className="profile-actions" aria-label="Páginas">
    <button className="secondary" disabled={!offset} onClick={() => setOffset(offset - 25)}>Anterior</button>
    <button className="secondary" disabled={!more || offset >= 10000} onClick={() => setOffset(offset + 25)}>Seguinte</button>
  </nav>;
}

export function BlogList({slug, category}: {slug?: string; category?: string}) {
  const [offset, setOffset] = useState(0);
  const query = new URLSearchParams({offset: String(offset)});
  if (slug) query.set("slug", slug);
  if (category) query.set("category", category);
  const {data, error} = useNetworkData<Result<Entry>>(`/blog/entries?${query}`);
  return <>
    <Feedback error={error} loading={!data} />
    {data?.items.map(entry => <article className="panel form-stack" key={entry.id}>
      <h3><Link href={`/blogue/${entry.id}`}>{entry.title}</Link></h3>
      <time dateTime={entry.published_at ?? undefined}>{entry.published_at?.slice(0, 10)}</time>
      <p>{entry.body}</p>
    </article>)}
    {data?.items.length === 0 && <p className="muted">Ainda não há publicações.</p>}
    <Pages offset={offset} setOffset={setOffset} more={data?.more} />
  </>;
}

function Ad({publisher, slot}: {publisher: string; slot: string}) {
  const pushed = useRef(false);
  return <aside className="panel" aria-label="Publicidade">
    <p className="muted">Publicidade</p>
    <ins className="adsbygoogle" style={{display: "block", minHeight: 120}} data-ad-client={publisher}
      data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    <Script id="sscix-adsense-library" async crossOrigin="anonymous" strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`}
      onReady={() => {
        if (pushed.current) return;
        pushed.current = true;
        const page = window as Window & {adsbygoogle?: object[]};
        (page.adsbygoogle ??= []).push({});
      }} />
  </aside>;
}

export function BlogArticle({id, publisher, slot}: {id: string; publisher: string; slot: string}) {
  const {data: entry, error} = useNetworkData<Entry>(`/blog/view/${encodeURIComponent(id)}`);
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState("");
  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api(`/blog/${id}/reports`, "POST", {reason: new FormData(form).get("reason")});
      form.reset();
      setFailure("");
      setStatus("Denúncia enviada à equipa.");
    } catch (error) { setFailure(message(error)); }
  }
  if (!entry || error) return <Feedback error={error} loading={!entry} />;
  return <>
    <article className="panel form-stack">
      <h1>{entry.title}</h1>
      <p>{entry.official ? <Link href="/blogue">Equipa da SSciX</Link> :
        <Link href={`/blogue/autor/${entry.slug}`}>{entry.author}</Link>}
        {entry.published_at && <> · <time dateTime={entry.published_at}>{entry.published_at.slice(0, 10)}</time></>}</p>
      {(entry.hidden || entry.visibility === "draft") && <p role="status">Pré-visualização. Texto indisponível aos leitores.</p>}
      {entry.cover && <img className="post-image" src={entry.cover} alt="" />}
      <div className="biography">{entry.body.split(/(https?:\/\/[^\s<>"']+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? <a key={index} href={part} rel="ugc noopener noreferrer">{part}</a> : part)}</div>
      {entry.corrections.length > 0 && <section>
        <h2>Correcções e actualizações</h2>
        <ul>{entry.corrections.map((revision, index) =>
          <li key={index}><time dateTime={revision.date}>{revision.date.slice(0, 10)}</time> · {revision.note}</li>)}</ul>
      </section>}
      {!entry.hidden && entry.visibility !== "draft" && <>
        <button className="secondary" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(location.href); setStatus("Ligação copiada para partilhares numa comunidade."); }
          catch { setStatus("Podes copiar a ligação da barra de endereços."); }
        }}>Copiar ligação para partilhar</button>
        <details>
          <summary>Denunciar</summary>
          <form className="form-stack" onSubmit={report}>
            <label>Motivo<textarea name="reason" minLength={3} maxLength={1000} required /></label>
            <button className="secondary">Enviar denúncia</button>
          </form>
        </details>
      </>}
      {status && <p role="status">{status}</p>}
      {failure && <p role="alert">{failure}</p>}
    </article>
    {entry.ads && publisher && slot && <Ad key={entry.id} publisher={publisher} slot={slot} />}
  </>;
}

export function BlogWorkspace({official = false}: {official?: boolean}) {
  const [selected, select] = useState("");
  const [offset, setOffset] = useState(0);
  const {data, error, refresh} = useNetworkData<Result<Entry>>(`/blog/mine?official=${official}&offset=${offset}`);
  return <>
    <Feedback error={error} loading={!data} />
    {data && <>
      <nav aria-label="Textos para editar" className="profile-actions">
        <button className="secondary" onClick={() => select("")}>Novo texto</button>
        {data.items.map(entry => <button className="secondary" key={entry.id} onClick={() => select(entry.id)}>
          {entry.title}{entry.visibility === "draft" ? " (rascunho)" : ""}
        </button>)}
      </nav>
      <Pages offset={offset} setOffset={setOffset} more={data.more} />
      <Editor key={selected || "new"} id={selected} official={official}
        saved={(id) => { select(id); refresh(); }} />
    </>}
  </>;
}

function Editor({id, official, saved}: {id: string; official: boolean; saved: (id: string) => void}) {
  const {data: entry, error, refresh} = useNetworkData<Entry>(id ? `/blog/mine/${id}` : null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setFeedback("");
    try {
      const file = fields.get("cover");
      const cover = file instanceof File && file.size ? await readImage(file, 260 * 1024)
        : fields.has("remove_cover") ? "" : entry?.cover ?? "";
      const result = await api<Entry>(id ? `/blog/entries/${id}` : "/blog/entries", id ? "PUT" : "POST", {
        title: fields.get("title"), body: fields.get("body"), category: official ? fields.get("category") : "investigacao",
        visibility: fields.get("visibility"), correction: fields.get("correction") ?? "", cover, official,
      });
      setFeedback("Texto guardado.");
      saved(result.id);
      refresh();
    } catch (error) { setFeedback(message(error)); }
    finally { setBusy(false); }
  }
  if (id && !entry) return <Feedback error={error} loading />;
  return <form className="panel form-stack" onSubmit={submit}>
    <h2>{id ? "Editar texto" : official ? "Nova publicação oficial" : "Novo texto"}</h2>
    {entry?.moderation_reason && <p role="status">Decisão editorial: {entry.moderation_reason}</p>}
    <label>Título<input name="title" defaultValue={entry?.title} maxLength={160} required /></label>
    {official && <label>Secção<select name="category" defaultValue={entry?.category ?? "novidades"}>
      {Object.entries(categories).filter(([key]) => key !== "investigacao")
        .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>}
    <label>Texto<textarea name="body" rows={12} defaultValue={entry?.body} maxLength={12000} required /></label>
    <label>Imagem de capa<input type="file" name="cover" accept="image/png,image/jpeg,image/webp" /></label>
    {entry?.cover && <label><input name="remove_cover" type="checkbox" /> Remover a capa actual</label>}
    <label>Visibilidade<select name="visibility" defaultValue={entry?.visibility ?? "draft"}>
      <option value="draft">Rascunho</option>
      <option value="public">Público</option>
      {!official && <option value="members">Só para membros</option>}
    </select></label>
    {entry?.published_at && <label>Nota de correcção ou actualização
      <input name="correction" maxLength={500} /></label>}
    <p><Link href="/blogue/politica">Política de publicação e monetização</Link></p>
    {id && <Link href={`/blogue/${id}`}>Abrir artigo</Link>}
    <button className="primary" disabled={busy}>Guardar</button>
    {feedback && <p role="status">{feedback}</p>}
  </form>;
}

export function Editorial() {
  const [offset, setOffset] = useState(0);
  const [reportOffset, setReportOffset] = useState(0);
  const [feedback, setFeedback] = useState("");
  const queue = useNetworkData<Result<Entry>>(`/admin/blog/entries?offset=${offset}`);
  const reports = useNetworkData<Result<Report>>(`/admin/blog/reports?offset=${reportOffset}`);

  async function review(event: FormEvent<HTMLFormElement>, route: string) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api(route, "PUT", Object.fromEntries(new FormData(form)));
      form.reset();
      setFeedback("Decisão registada.");
      queue.refresh();
      reports.refresh();
    } catch (error) { setFeedback(message(error)); }
  }
  return <>
    <h2>Moderação e publicidade</h2>
    {feedback && <p role="status">{feedback}</p>}
    <Feedback error={queue.error} loading={!queue.data} />
    {queue.data?.items.map(entry => <form className="panel form-stack" key={entry.id}
      onSubmit={event => void review(event, `/admin/blog/entries/${entry.id}`)}>
      <h3><Link href={`/blogue/${entry.id}`}>{entry.title}</Link></h3>
      <p>{entry.hidden ? "Oculto" : entry.visibility === "public" ? "Público" : "Só para membros"} · {entry.ads ? "Anúncios ligados" : "Anúncios desligados"}</p>
      <label>Acção<select name="action">
        {!entry.hidden && entry.visibility === "public" && !entry.ads && <option value="ads_on">Activar anúncio após revisão</option>}
        {entry.ads && <option value="ads_off">Desactivar anúncio</option>}
        {entry.hidden ? <option value="restore">Restaurar visibilidade</option> : <option value="hide">Ocultar artigo</option>}
      </select></label>
      <label>Motivo<input name="reason" minLength={3} maxLength={1000} required /></label>
      <button className="secondary">Registar decisão</button>
    </form>)}
    <Pages offset={offset} setOffset={setOffset} more={queue.data?.more} />
    <h2>Denúncias pendentes</h2>
    <Feedback error={reports.error} loading={!reports.data} />
    {reports.data?.items.length === 0 && <p>Sem denúncias pendentes.</p>}
    {reports.data?.items.map(item => <form className="panel form-stack" key={item.id}
      onSubmit={event => void review(event, `/admin/blog/reports/${item.id}`)}>
      <Link href={`/blogue/${item.entry_id}`}>Abrir artigo denunciado</Link>
      <p>{item.reason}</p>
      <label>Motivo da resolução<input name="reason" minLength={3} maxLength={1000} required /></label>
      <button className="secondary">Marcar como resolvida</button>
    </form>)}
    <Pages offset={reportOffset} setOffset={setReportOffset} more={reports.data?.more} />
  </>;
}
