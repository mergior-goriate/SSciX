"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api, message } from "../api-client";
import { ArrowLeft, ArrowRight, FileText, Image as ImageIcon, LockKeyhole, MessageSquare, BookOpen, Plus, Search, Users, X, Bookmark, Heart, ImagePlus, Link as LinkIcon, MessageCircle, Forward, Smile } from "lucide-react";
import Avatar from "../avatar";
import { readImage } from "../media";
import FollowButton from "../u/[slug]/follow-button";

type Post = {
  id: string;
  body: string;
  author_name: string;
  author_photo: string;
  image: string;
  article_url: string;
  likes: number;
  liked: boolean;
  saved: boolean;
  author_slug: string;
  created_at: string;
  community_name: string | null;
  community_id: string | null;
};
type Community = { id: string; name: string; description: string; photo: string; can_edit_photo: boolean };

function CommunityPortrait({ photo }: { photo?: string }) {
  return <span className="community-list-icon" aria-hidden="true">
    {photo ? <img src={photo} alt="" /> : <Users size={22} />}
  </span>;
}

function CommunityPhotoInput({ required = false }: { required?: boolean }) {
  return <label>Fotografia da comunidade
    <input type="file" name="photo_file" accept="image/png,image/jpeg,image/webp" required={required} />
    <small>PNG, JPEG ou WebP, até 260 KB.</small>
  </label>;
}

export function useNetworkData<T>(path: string, revision = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setData(undefined);
    api<T>(path).then((result) => {
      if (active) setData(result);
    }).catch((failure) => {
      if (active) setError(failure?.status === 401 ? "Inicie sessão para consultar esta secção." : message(failure));
    });
    return () => { active = false; };
  }, [path, version, revision]);

  return { data, error, refresh: () => setVersion((value) => value + 1) };
}

const emojis = ["😊", "👏", "💡", "🔬", "📚", "✅", "🤝", "🎓"];

function Composer({ endpoint, label, communityId, onSaved }: {
  endpoint: string; label: string; communityId?: string; onSaved: () => void;
}) {
  const canAttach = endpoint === "/feed";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [article, setArticle] = useState(false);
  const [emojiMenu, setEmojiMenu] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  async function attach(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setImage(await readImage(file, 500 * 1024));
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  function insertEmoji(emoji: string) {
    const field = input.current;
    if (!field) return;
    const { selectionStart, selectionEnd } = field;
    const next = body.slice(0, selectionStart) + emoji + body.slice(selectionEnd);
    if (next.length > 2400) return;
    setBody(next);
    setEmojiMenu(false);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(selectionStart + emoji.length, selectionStart + emoji.length);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    const form = event.currentTarget;
    const articleUrl = String(new FormData(form).get("article_url") ?? "");
    setBusy(true);
    setError("");
    try {
      await api(endpoint, "POST", {
        body: body.trim(), ...(canAttach ? { image, article_url: articleUrl, community_id: communityId } : {}),
      });
      setBody("");
      setImage("");
      setArticle(false);
      setEmojiMenu(false);
      form.reset();
      onSaved();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <form className="panel form-stack network-composer" onSubmit={submit}>
    <label>{canAttach ? "Criar publicação" : label}
      <textarea ref={input} name="body" rows={3} maxLength={2400} value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={canAttach ? "Partilhe um resultado, uma pergunta ou uma proposta de colaboração." : undefined} required />
    </label>
    <small>Use @ seguido do endereço público do perfil para mencionar alguém.</small>
    {article && <label>Ligação para um artigo<input name="article_url" type="url" maxLength={1000} /></label>}
    {image && <div className="composer-preview"><img src={image} alt="Pré-visualização da imagem" />
      <button type="button" className="secondary" onClick={() => setImage("")}>Remover imagem</button></div>}
    <div className="composer-tools">
      <button className="secondary icon-action" type="button" aria-expanded={emojiMenu}
        onClick={() => setEmojiMenu(!emojiMenu)}><Smile size={18} aria-hidden="true" /> Emojis</button>
      {canAttach && <>
        <label className="secondary attachment-label"><ImagePlus size={18} aria-hidden="true" /> Imagem
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
            onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        <button className="secondary icon-action" type="button" aria-expanded={article}
          onClick={() => setArticle(!article)}><LinkIcon size={18} aria-hidden="true" /> Artigo</button>
      </>}
      <button className="primary" disabled={busy}>{label}</button>
    </div>
    {emojiMenu && <div className="emoji-options" role="group" aria-label="Escolher emoji">
      {emojis.map((emoji) => <button className="secondary" key={emoji} type="button" onClick={() => insertEmoji(emoji)}>{emoji}</button>)}
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </form>;
}

type Person = { slug: string; name: string; photo: string };

export function ResearcherDiscovery({ similarTo }: { similarTo?: string }) {
  const path = "/profiles/discover/suggestions" + (similarTo ? `?similar_to=${similarTo}` : "");
  const { data, error } = useNetworkData<Person[]>(path);

  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const visible = expanded ? data : data?.slice(0, 3);

  return <div className="feed-discovery" role="region" aria-label={similarTo ? "Perfis semelhantes" : "Descobrir investigadores"}>
    <section className="panel">
      <h2>{similarTo ? "Perfis semelhantes" : "Investigadores para seguir"}</h2>
      {error ? <p className="muted" role="alert">{error}</p> :
        !visible ? <p className="muted" role="status">A carregar perfis…</p> :
          !visible.length ? <p className="muted">Ainda não há sugestões.</p> :
            <ul className="feed-researchers" id={listId}>{visible.map((person) => (
              <li key={person.slug}>
                <Link className="researcher-identity" href={`/u/${person.slug}`}>
                  <Avatar name={person.name} photo={person.photo} />
                  <span className="researcher-name">
                    <strong title={person.name}>{person.name}</strong>
                    <small title={`@${person.slug}`}>@{person.slug}</small>
                  </span>
                </Link>
                <FollowButton slug={person.slug} />
              </li>
            ))}</ul>}
      <div className="researcher-links">
        {data && data.length > 3 && <button className="researcher-more" type="button"
          aria-controls={listId} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Mostrar menos" : "Mostrar mais"}
        </button>}
        {(!data || data.length <= 3 || expanded) && <Link href="/pessoas">Ver directório de pessoas</Link>}
      </div>
    </section>
  </div>;
}

type Actions = { liked: boolean; saved: boolean; likes: number };

function PostActions({ post, onChange }: { post: Post; onChange?: () => void }) {
  const path = `/feed/${post.id}/actions`;
  const [actions, setActions] = useState<Actions>({ liked: post.liked, saved: post.saved, likes: post.likes });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  async function toggle(action: "like" | "save", value: boolean) {
    setBusy(true);
    setFeedback("");
    try {
      setActions(await api<Actions>(`${path}/${action}`, value ? "DELETE" : "PUT"));
      if (action === "save" && value) onChange?.();
    } catch (failure) {
      setFeedback(message(failure));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = new URL(`/rede/${post.id}`, window.location.origin).href;
    setFeedback("");
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Ligação copiada.");
    } catch {
      setShareUrl(url);
    }
  }

  return <>
    <div className="post-actions">
      <button type="button" aria-pressed={actions.liked} disabled={busy} onClick={() => void toggle("like", actions.liked)}>
        <Heart size={18} aria-hidden="true" /> Gostar <span aria-label={`${actions.likes} gostos`}>{actions.likes}</span>
      </button>
      <Link href={`/rede/${post.id}#comentarios`}><MessageCircle size={18} aria-hidden="true" /> Comentar</Link>
      <button type="button" onClick={() => void share()}><Forward size={18} aria-hidden="true" /> Partilhar</button>
      <button type="button" aria-pressed={actions.saved} disabled={busy} onClick={() => void toggle("save", actions.saved)}>
        <Bookmark size={18} aria-hidden="true" /> {actions.saved ? (onChange ? "Remover dos guardados" : "Guardado") : "Guardar"}
      </button>
    </div>
    {shareUrl && <label>Ligação para partilhar<input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}
    {feedback && <p className="muted" role="status">{feedback}</p>}
  </>;
}

function PostCard({ post, topic, onChange }: { post: Post; topic?: boolean; onChange?: () => void }) {
  return <article className="panel network-post">
    <header>
      <div className="feed-author">
        <Avatar name={post.author_name} photo={post.author_photo} />
        <Link href={`/u/${post.author_slug}`}><strong>{post.author_name}</strong></Link>
      </div>
      <time className="muted" dateTime={post.created_at}>{post.created_at.slice(0, 10)}</time>
    </header>
    {post.community_id && <Link href={`/comunidades/${post.community_id}`}>{post.community_name}</Link>}
    <p className="biography">{post.body}</p>
    {post.image && <img className="post-image" src={post.image} alt="Imagem anexada à publicação" loading="lazy" />}
    {post.article_url && <a className="icon-action" href={post.article_url} rel="noopener noreferrer" target="_blank">
      <LinkIcon size={17} aria-hidden="true" /> Abrir artigo
    </a>}
    {topic && <PostActions post={post} onChange={onChange} />}
  </article>;
}

function Posts({ data, error, empty, topic, onChange }: {
  data?: Post[]; error: string; empty: string; topic?: boolean; onChange?: () => void;
}) {
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!data) return <p role="status">A carregar…</p>;
  if (!data.length) return <p className="muted">{empty}</p>;
  return data.map((post) => <PostCard key={post.id} post={post} topic={topic} onChange={onChange} />);
}

const savedFilters = [
  { id: "all", label: "Todas", icon: Bookmark },
  { id: "articles", label: "Com artigo", icon: FileText },
  { id: "images", label: "Com imagem", icon: ImageIcon },
] as const;

export function SavedPosts() {
  const { data, error, refresh } = useNetworkData<Post[]>("/saved");
  const [filter, setFilter] = useState<(typeof savedFilters)[number]["id"]>("all");
  const visible = data?.filter((post) => filter === "all" || (filter === "articles" ? post.article_url : post.image));

  return <>
    <header className="information-hero">
      <div>
        <h1>Publicações guardadas</h1>
        <p className="saved-privacy"><LockKeyhole size={16} aria-hidden="true" /> Visíveis apenas para si</p>
      </div>
      <span className="information-hero-icon"><Bookmark size={32} aria-hidden="true" /></span>
    </header>
    <div className="saved-layout">
      <div className="panel settings-categories saved-filters" role="group" aria-label="Filtrar publicações guardadas">
        {savedFilters.map(({ id, label, icon: Icon }) =>
          <button key={id} type="button" aria-pressed={id === filter} onClick={() => setFilter(id)}>
            <Icon size={18} aria-hidden="true" />{label}
          </button>)}
      </div>
      <section className="network-stack" aria-label="Resultados dos guardados">
        {error ? <p className="notice error" role="alert">{error}</p> :
          !visible ? <p role="status">A carregar…</p> :
            !visible.length ? <div className="panel saved-empty">
              <Bookmark size={28} aria-hidden="true" />
              <p role="status">{data?.length ? "Nenhuma publicação neste filtro." : "Ainda não guardou publicações."}</p>
              {data?.length ? <button type="button" className="secondary" onClick={() => setFilter("all")}>Ver todas</button> :
                <Link href="/rede" className="secondary">Explorar o feed</Link>}
            </div> :
              visible.map((post) => <article className="panel saved-card" key={post.id}>
                <div className="saved-card-main">
                  <Link className="saved-preview" href={`/rede/${post.id}`} aria-label="Abrir publicação">
                    {post.image ? <img src={post.image} alt="" loading="lazy" /> : <FileText size={25} aria-hidden="true" />}
                  </Link>
                  <div className="saved-card-copy">
                    <div className="feed-author">
                      <Avatar name={post.author_name} photo={post.author_photo} />
                      <Link href={`/u/${post.author_slug}`}><strong>{post.author_name}</strong></Link>
                      <time className="muted" dateTime={post.created_at}>{post.created_at.slice(0, 10)}</time>
                    </div>
                    <p className="biography">{post.body}</p>
                    {post.article_url && <a className="icon-action" href={post.article_url} target="_blank" rel="noopener noreferrer">
                      <LinkIcon size={16} aria-hidden="true" /> Abrir artigo
                    </a>}
                  </div>
                </div>
                <PostActions post={post} onChange={refresh} />
              </article>)}
      </section>
    </div>
  </>;
}

export function ProfilePosts({ slug }: { slug: string }) {
  const { data, error } = useNetworkData<Post[]>(`/feed?author=${encodeURIComponent(slug)}`);
  return <div className="network-stack">
    <Posts data={data} error={error} empty="Este perfil ainda não tem publicações públicas." topic />
  </div>;
}

export function CommunityHighlights() {
  const { data, error } = useNetworkData<Community[]>("/communities");
  return <section className="panel context-communities">
    <h2>Comunidades</h2>
    {error ? <p className="muted">{error}</p> : !data ? <p role="status">A carregar…</p> :
      data.length ? <ul>{data.slice(0, 3).map((community) => <li key={community.id}>
        <Link className="community-highlight-link" href={`/comunidades/${community.id}`}>
          <CommunityPortrait photo={community.photo} />
          <span>{community.name}<small>{community.description}</small></span>
        </Link>
      </li>)}</ul> : <p className="muted">Ainda não há comunidades.</p>}
    <Link href="/comunidades">Ver comunidades</Link>
  </section>;
}

export function Feed({ communityId }: { communityId?: string }) {
  const [following, setFollowing] = useState(false);
  const path = communityId ? `/feed?community_id=${communityId}` : `/feed?following=${following}`;
  const { data, error, refresh } = useNetworkData<Post[]>(path);

  return <div className="network-stack">
    <Composer endpoint="/feed" communityId={communityId} label="Publicar" onSaved={() => {
      if (following) setFollowing(false);
      refresh();
    }} />
    {!communityId && <div className="feed-filters" role="group" aria-label="Filtrar publicações">
      <button className="secondary" aria-pressed={!following} onClick={() => setFollowing(false)}>Publicações recentes</button>
      <button className="secondary" aria-pressed={following} onClick={() => setFollowing(true)}>Pessoas que sigo</button>
    </div>}
    {communityId && data?.length === 0 ? <div className="panel community-empty" role="status">
      <MessageSquare size={25} aria-hidden="true" />
      <strong>Ainda não há debates nesta comunidade.</strong>
      <p>Publique uma pergunta, um resultado ou uma proposta de colaboração.</p>
    </div> : <Posts data={data} error={error} empty="Ainda não há publicações para mostrar." topic />}
  </div>;
}

export function Topic({ id }: { id: string }) {
  const topic = useNetworkData<Post>(`/feed/${id}`);
  const replies = useNetworkData<Post[]>(`/feed/${id}/replies`);
  if (topic.error) return <p role="alert">{topic.error}</p>;
  if (!topic.data) return <p role="status">A carregar o debate…</p>;

  return <div className="network-stack">
    <PostCard post={topic.data} topic />
    <h2 id="comentarios">Comentários</h2>
    <Posts data={replies.data} error={replies.error} empty="Ainda não há respostas." />
    <Composer endpoint={`/feed/${id}/replies`} label="Comentar" onSaved={replies.refresh} />
  </div>;
}

export function CommunityDirectory() {
  const { data, error, refresh } = useNetworkData<Community[]>("/communities");
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const normalise = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const query = normalise(search.trim());
  const visible = data?.filter(({ name, description }) => normalise(`${name} ${description}`).includes(query));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setFailure("");
    try {
      const { photo_file, ...fields } = Object.fromEntries(new FormData(form));
      const photo = photo_file instanceof File && photo_file.size ? await readImage(photo_file, 260 * 1024) : "";
      await api("/communities", "POST", { ...fields, photo });
      form.reset();
      dialog.current?.close();
      setSearch("");
      refresh();
    } catch (err) {
      setFailure(message(err));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <header className="information-hero community-hero">
      <h1>Comunidades</h1>
      <button className="secondary" type="button" onClick={() => dialog.current?.showModal()}>
        <Plus size={19} aria-hidden="true" /> Criar comunidade
      </button>
    </header>
    <div className="community-directory">
      <section className="panel community-results">
        <h2>Explorar comunidades</h2>
        <label className="community-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label="Pesquisar comunidades" placeholder="Pesquisar por nome ou tema"
            value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {error ? <p role="alert">{error}</p> : !visible ? <p role="status">A carregar…</p> :
          !visible.length ? <p className="muted" role="status">{query ? "Nenhuma comunidade encontrada." : "Ainda não há comunidades."}</p> :
            <ul className="community-list">{visible.map((community) => <li key={community.id}>
              <Link href={`/comunidades/${community.id}`}>
                <CommunityPortrait photo={community.photo} />
                <span><strong>{community.name}</strong><small>{community.description}</small></span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </li>)}</ul>}
      </section>
      <aside className="panel community-guide">
        <h2><BookOpen size={20} aria-hidden="true" /> Participar nos debates</h2>
        <p className="muted">Consulte as orientações antes de publicar ou comentar numa comunidade.</p>
        <Link href="/ajuda#comunidades">Políticas das comunidades</Link>
      </aside>
    </div>
    <dialog className="panel community-dialog" ref={dialog} aria-labelledby="create-community-title"
      onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <header>
        <h2 id="create-community-title">Criar comunidade</h2>
        <button className="secondary" type="button" aria-label="Fechar formulário" disabled={busy}
          onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
      </header>
      <form className="form-stack" onSubmit={create}>
        <label>Nome<input name="name" minLength={2} maxLength={120} required /></label>
        <label>Âmbito da comunidade<textarea name="description" rows={3} maxLength={600} required /></label>
        <CommunityPhotoInput />
        <button className="primary" disabled={busy}>Criar comunidade</button>
        {failure && <p className="notice error" role="alert">{failure}</p>}
      </form>
    </dialog>
  </>;
}

export function CommunityPage({ id }: { id: string }) {
  const { data, error } = useNetworkData<Community>(`/communities/${id}`);
  const [updatedPhoto, setUpdatedPhoto] = useState<string>();
  const [photoStatus, setPhotoStatus] = useState<{ text: string; error?: boolean }>();
  const [savingPhoto, setSavingPhoto] = useState(false);
  const photo = updatedPhoto ?? data?.photo;

  async function savePhoto(file: File | null) {
    if (savingPhoto) return;
    setSavingPhoto(true);
    setPhotoStatus(undefined);
    try {
      const photoData = file ? await readImage(file, 260 * 1024) : "";
      const updated = await api<Community>(`/communities/${id}/photo`, "PUT", { photo: photoData });
      setUpdatedPhoto(updated.photo ? `${updated.photo}?v=${Date.now()}` : "");
      setPhotoStatus({ text: file ? "Fotografia guardada." : "Fotografia removida." });
      return true;
    } catch (err) {
      setPhotoStatus({ text: message(err), error: true });
    } finally {
      setSavingPhoto(false);
    }
  }
  return <>
    <nav aria-label="Percurso da comunidade" className="community-return">
      <Link href="/comunidades"><ArrowLeft size={18} aria-hidden="true" /> Todas as comunidades</Link>
    </nav>
    {error ? <p className="notice error" role="alert">{error}</p> :
      !data ? <p role="status">A carregar a comunidade…</p> : <>
        <header className="information-hero community-detail-hero">
          <CommunityPortrait photo={photo} />
          <h1>{data.name}</h1>
        </header>
        <div className="community-directory community-detail-grid">
          <section className="community-debates" aria-labelledby="community-debates-title">
            <h2 id="community-debates-title">Debates</h2>
            <Feed communityId={id} />
          </section>
          <aside className="panel community-guide community-about">
            <h2><BookOpen size={20} aria-hidden="true" /> Sobre a comunidade</h2>
            <p className="biography muted">{data.description}</p>
            <Link href="/ajuda#comunidades">Políticas das comunidades</Link>
            {data.can_edit_photo && <form className="form-stack community-photo-form" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const file = new FormData(form).get("photo_file");
              if (file instanceof File && file.size) void savePhoto(file).then((saved) => { if (saved) form.reset(); });
            }}>
              <CommunityPhotoInput required />
              <button className="primary" disabled={savingPhoto}>{photo ? "Alterar fotografia" : "Adicionar fotografia"}</button>
              {photo && <button className="secondary" type="button" disabled={savingPhoto} onClick={() => void savePhoto(null)}>Remover fotografia</button>}
              {photoStatus && <p role={photoStatus.error ? "alert" : "status"} className={photoStatus.error ? "notice error" : "notice"}>{photoStatus.text}</p>}
            </form>}
          </aside>
        </div>
      </>}
  </>;
}
