"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Avatar from "./avatar";
import { api, message } from "./api-client";
import { readImage } from "./media";
import { useNetworkData } from "./use-network-data";

type Entry = { id: string; label: string; query: string; post_id: string | null; date: string };
type Story = { id: string; body: string; image: string; link: string; author: string; expires_at: string; can_delete: boolean };
type Affiliation = { id: string; institution: string; role: string; started_on: string | null; ended_on: string | null; verified_at: string | null };
type Revision = { id: string; note: string; previous_body: string; created_at: string };

function useMutation(refresh?: () => void) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function run(action: () => Promise<unknown>, confirmation = "") {
    setBusy(true);
    setStatus("");
    try {
      await action();
      refresh?.();
      setStatus(confirmation);
      return true;
    } catch (failure) {
      setStatus(message(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, status, run, clearStatus: () => setStatus("") };
}

export function PersonalActivity() {
  const { data, error, refresh } = useNetworkData<{ enabled: boolean; entries: Entry[] }>("/activity");
  const { busy, status, run } = useMutation(refresh);
  return <div className="network-stack">
    <section className="panel form-stack">
      <h2>Histórico de pesquisas e leituras</h2>
      <p>O registo é opcional e só pode ser consultado na sua conta. Aparecem até 40 entradas dos últimos 90 dias.</p>
      {data && <div className="feed-filters">
        <button className="secondary" type="button" disabled={busy} onClick={() =>
          void run(() => api("/activity/settings", "PUT", { enabled: !data.enabled }))}>
          {data.enabled ? "Pausar registo" : "Activar registo"}
        </button>
        <button className="secondary" type="button" disabled={busy || !data.entries.length} onClick={() =>
          void run(() => api("/activity", "DELETE"))}>Limpar histórico</button>
      </div>}
      {(status || error) && <p role="status">{status || error}</p>}
      {data?.entries.length === 0 && <p>Ainda não há actividade registada.</p>}
      {data && data.entries.length > 0 && <ul className="form-stack">{data.entries.map((entry) => <li key={entry.id}>
        <Link href={entry.post_id ? `/rede/${entry.post_id}` : `/rede?q=${encodeURIComponent(entry.query)}`}>{entry.label}</Link>
        {" "}<button className="secondary" type="button" disabled={busy} aria-label={`Apagar ${entry.label}`}
          onClick={() => void run(() => api(`/activity/${entry.id}`, "DELETE"))}>Apagar</button>
      </li>)}</ul>}
    </section>
    <StoryPanel archive />
  </div>;
}

export function StoryPanel({ archive = false, profile }: {
  archive?: boolean; profile?: { name: string; photo: string };
}) {
  const { data, error, refresh } = useNetworkData<Story[]>(`/stories?archived=${archive}`);
  const { data: communities } = useNetworkData<{ id: string; name: string; is_private: boolean }[]>(archive ? null : "/communities");
  const { busy, status, run, clearStatus } = useMutation(refresh);
  const [audience, setAudience] = useState("followers");
  const [stamp, setStamp] = useState(Date.now);
  const [selected, setSelected] = useState<Story>();
  const [scroll, setScroll] = useState({ back: false, next: false });
  const rail = useRef<HTMLUListElement>(null);
  const createDialog = useRef<HTMLDialogElement>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const createId = useId();
  const viewerId = useId();
  useEffect(() => {
    if (archive || !data?.length) return;
    const timer = setInterval(() => setStamp(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [archive, data]);
  const visible = data?.filter((story) => archive || Date.parse(story.expires_at) > stamp);
  const count = visible?.length ?? 0;

  useEffect(() => {
    const list = rail.current;
    if (!list) return;
    const update = () => {
      setScroll({
        back: list.scrollLeft > 1,
        next: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, [count]);

  useEffect(() => {
    if (!selected) return;
    if (Date.parse(selected.expires_at) <= stamp) viewer.current?.close();
    else if (!viewer.current?.open) viewer.current?.showModal();
  }, [selected, stamp]);

  function move(direction: number) {
    const list = rail.current;
    if (list) list.scrollBy({ left: direction * list.clientWidth * .85 });
  }

  async function remove(id: string) {
    if (await run(() => api(`/stories/${id}`, "DELETE"), "História apagada.")) viewer.current?.close();
  }

  function storyContent(story: Story) {
    return <>
      {story.image && <img className="academic-story-image" src={story.image} alt="Fotografia da história" loading="lazy" />}
      {story.body && <p className="biography">{story.body}</p>}
      {story.link && <a href={story.link} rel="noreferrer">Abrir conteúdo associado</a>}
      {story.can_delete && <button className="secondary" type="button" disabled={busy} onClick={() => void remove(story.id)}>
        Apagar história
      </button>}
    </>;
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (await run(async () => {
      const file = fields.get("photo");
      const image = file instanceof File && file.size ? await readImage(file, 260 * 1024) : "";
      await api("/stories", "POST", { body: fields.get("body"), link: fields.get("link"), image, audience,
        community_id: audience === "community" ? fields.get("community") : null, archive: fields.has("archive") });
    }, "História publicada.")) {
      form.reset();
      setAudience("followers");
      createDialog.current?.close();
    }
  }

  if (archive) return <section className="panel form-stack">
    <h2>Arquivo privado de stories</h2>
    {(status || error) && <p role="status">{status || error}</p>}
    {visible?.length === 0 && <p>Ainda não há stories arquivados.</p>}
    {visible?.map((story) => <details key={story.id}>
      <summary>{story.author}{story.body ? ` · ${story.body.slice(0, 65)}` : ""}</summary>
      {storyContent(story)}
    </details>)}
  </section>;

  return <section className="feed-stories" aria-labelledby={headingId}>
    <h2 id={headingId}>Histórias académicas</h2>
    <div className="story-carousel">
      <ul className="story-rail" ref={rail}>
        <li>
          <button className="story-card story-create" type="button" aria-label="Criar história" onClick={() => { clearStatus(); createDialog.current?.showModal(); }}>
            <span className="story-card-cover">
              <Avatar name={profile?.name || "Meu perfil"} photo={profile?.photo} />
            </span>
            <span className="story-create-caption">
              <span className="story-plus"><Plus size={20} aria-hidden="true" /></span>
              Criar história
            </span>
          </button>
        </li>
        {visible?.map((story) => <li key={story.id}>
          <button className="story-card story-preview" type="button"
            aria-label={`Ver história de ${story.author}${story.body ? `: ${story.body.slice(0, 65)}` : ""}`}
            onClick={() => { clearStatus(); setSelected(story); }}>
            {story.image && <img className="story-artwork" src={story.image} alt="" loading="lazy" />}
            <Avatar name={story.author} />
            {!story.image && story.body && <span className="story-excerpt">{story.body}</span>}
            <strong>{story.author}</strong>
          </button>
        </li>)}
      </ul>
      {scroll.back && <button className="secondary story-scroll story-scroll-back" type="button"
        aria-label="Histórias anteriores" onClick={() => move(-1)}><ChevronLeft size={19} aria-hidden="true" /></button>}
      {scroll.next && <button className="secondary story-scroll story-scroll-next" type="button"
        aria-label="Mais histórias" onClick={() => move(1)}><ChevronRight size={19} aria-hidden="true" /></button>}
    </div>
    <p className="story-status" role="status">{status || error || (visible?.length === 0 ? "Ainda não há histórias activas." : "")}</p>
    <dialog className="panel community-dialog feed-dialog" ref={createDialog} aria-labelledby={createId}>
      <header>
        <h2 id={createId}>Criar história</h2>
        <button className="secondary" type="button" aria-label="Fechar" onClick={() => createDialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <form className="form-stack" onSubmit={publish}>
        <label>Texto<textarea name="body" maxLength={500} rows={2} autoFocus /></label>
        <label>Fotografia<input name="photo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        <label>Ligação para conteúdo académico<input name="link" type="url" maxLength={1000} /></label>
        <label>Quem pode ver<select value={audience} onChange={(event) => setAudience(event.target.value)}>
          <option value="followers">Seguidores</option><option value="public">Membros da SSciX</option>
          <option value="community" disabled={!communities?.some((value) => value.is_private)}>Comunidade privada</option>
        </select></label>
        {audience === "community" && <label>Comunidade<select name="community" required>
          {communities?.filter((value) => value.is_private).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
        </select></label>}
        <label><input name="archive" type="checkbox" /> Guardar no meu arquivo após 24 horas</label>
        <button className="primary" disabled={busy}>Publicar história</button>
        {status && <p role="alert">{status}</p>}
      </form>
    </dialog>
    <dialog className="panel community-dialog feed-dialog" ref={viewer} aria-labelledby={viewerId} onClose={() => setSelected(undefined)}>
      <header>
        <h2 id={viewerId}>{selected ? `História de ${selected.author}` : "História académica"}</h2>
        <button className="secondary" type="button" aria-label="Fechar" onClick={() => viewer.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {selected && <div className="form-stack story-viewer">{storyContent(selected)}
        {status && <p role="alert">{status}</p>}
      </div>}
    </dialog>
  </section>;
}

export function Affiliations({ slug }: { slug?: string }) {
  const { data, error, refresh } = useNetworkData<Affiliation[]>(slug ? `/affiliations/${slug}` : "/affiliations");
  const { busy, status, run } = useMutation(refresh);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    if (await run(() => api("/affiliations", "POST", { ...fields,
      started_on: fields.started_on || null, ended_on: fields.ended_on || null }), "Afiliação guardada.")) form.reset();
  }

  if (slug && !data?.length) return null;
  return <section className="panel form-stack">
    <h2>Afiliações académicas</h2>
    {data?.map((record) => <div key={record.id}>
      <strong>{record.institution}</strong><p>{record.role} · {record.started_on ? `Desde ${record.started_on} · ` : ""}
        {record.ended_on ? `Até ${record.ended_on}` : "Actual"} · {record.verified_at ? "Validada pela instituição" : "Auto-declarada"}</p>
      {!slug && <><small>Identificador para validação institucional: {record.id}</small>{" "}
        <button className="secondary" disabled={busy} onClick={() =>
          void run(() => api(`/affiliations/${record.id}`, "DELETE"))}>Remover</button></>}
    </div>)}
    {!slug && <form className="form-stack" onSubmit={add}>
      <label>Instituição<input name="institution" maxLength={160} required /></label>
      <label>Função<input name="role" maxLength={120} required /></label>
      <label>Início<input name="started_on" type="date" /></label>
      <label>Fim<input name="ended_on" type="date" /></label>
      <button className="primary" disabled={busy}>Adicionar afiliação</button>
    </form>}
    {(status || error) && <p role="status">{status || error}</p>}
  </section>;
}

export function PublicationRevisions({ id, body, canEdit, onSaved }: { id: string; body: string; canEdit: boolean; onSaved: () => void }) {
  const { data, error, refresh } = useNetworkData<Revision[]>(`/revisions/${id}`);
  const { busy, status, run } = useMutation(refresh);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    if (await run(() => api(`/revisions/${id}`, "PUT", fields), "Correcção guardada.")) {
      onSaved();
      (form.elements.namedItem("note") as HTMLInputElement).value = "";
    }
  }

  if (!canEdit && !data?.length) return null;
  return <details className="panel">
    <summary>Histórico de correcções</summary>
    {data?.map((revision) => <details key={revision.id}>
      <summary>{new Date(revision.created_at).toLocaleDateString("pt-MZ")} · {revision.note}</summary>
      <p className="biography">{revision.previous_body}</p>
    </details>)}
    {canEdit && <form className="form-stack" onSubmit={save}>
      <label>Texto corrigido<textarea key={body} name="body" defaultValue={body} maxLength={2400} required /></label>
      <label>O que mudou?<input name="note" maxLength={300} required /></label>
      <button className="primary" disabled={busy}>Guardar correcção</button>
    </form>}
    {(status || error) && <p role="status">{status || error}</p>}
  </details>;
}

export function CommunityAccess({ id }: { id: string }) {
  const { busy, status, run } = useMutation();
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const slug = String(new FormData(form).get("slug") ?? "").trim().toLowerCase();
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const remove = button?.value === "remove";
    if (await run(() => api(`/community-members/${id}/${encodeURIComponent(slug)}`, remove ? "DELETE" : "PUT"),
      remove ? "Acesso removido." : "Acesso concedido.")) form.reset();
  }
  return <details className="panel">
    <summary>Gerir acesso à comunidade privada</summary>
    <form className="form-stack" onSubmit={change}>
      <label>Endereço do perfil do membro<input name="slug" maxLength={40} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
      <div className="feed-filters"><button className="primary" disabled={busy}>Conceder acesso</button>
        <button className="secondary" value="remove" disabled={busy}>Remover acesso</button></div>
      {status && <p role="status">{status}</p>}
    </form>
  </details>;
}
