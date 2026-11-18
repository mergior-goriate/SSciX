"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, message } from "../api-client";
import { Bookmark, Heart, ImagePlus, Link as LinkIcon, MessageCircle, Forward, Smile } from "lucide-react";
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
type Community = { id: string; name: string; description: string };

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

type Person = { slug: string; name: string; institution: string; specialization: string; photo: string; common_keywords: string[] };

export function ResearcherDiscovery({ similarTo }: { similarTo?: string }) {
  const path = "/profiles/discover/suggestions" + (similarTo ? `?similar_to=${similarTo}` : "");
  const { data, error } = useNetworkData<Person[]>(path);

  return <div className="feed-discovery" role="region" aria-label={similarTo ? "Perfis semelhantes" : "Descobrir investigadores"}>
    <section className="panel">
      <h2>{similarTo ? "Perfis semelhantes" : "Investigadores para seguir"}</h2>
      {error ? <p className="muted">{error}</p> :
        !data ? <p className="muted" role="status">A carregar perfis…</p> :
          !data.length ? <p className="muted">Ainda não há sugestões.</p> :
            <ul className="feed-researchers">{data.map((person) => (
              <li key={person.slug}>
                <div className="researcher-identity">
                  <Avatar name={person.name} photo={person.photo} />
                  <div>
                    <Link href={`/u/${person.slug}`}>{person.name}</Link>
                    {(person.institution || person.specialization) && <small>{person.institution || person.specialization}</small>}
                  </div>
                </div>
                {person.common_keywords.length > 0 && <small className="researcher-topics">
                  Em comum: {person.common_keywords.join(", ")}
                </small>}
                <FollowButton slug={person.slug} showCounts />
              </li>
            ))}</ul>}
      <Link href="/pessoas">Ver directório de pessoas</Link>
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
        <Bookmark size={18} aria-hidden="true" /> {actions.saved ? "Guardado" : "Guardar"}
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

export function SavedPosts() {
  const { data, error, refresh } = useNetworkData<Post[]>("/saved");
  return <div className="network-stack"><Posts data={data} error={error}
    empty="Ainda não guardou publicações." topic onChange={refresh} /></div>;
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
        <Link href={`/comunidades/${community.id}`}>{community.name}</Link>
        <small>{community.description}</small>
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
    <Posts data={data} error={error} empty="Ainda não há publicações para mostrar." topic />
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
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setFailure("");
    try {
      await api("/communities", "POST", Object.fromEntries(new FormData(form)));
      form.reset();
      refresh();
    } catch (err) {
      setFailure(message(err));
    } finally {
      setBusy(false);
    }
  }

  return <div className="network-stack">
    <form className="panel form-stack" onSubmit={create}>
      <h2>Criar comunidade</h2>
      <label>Nome<input name="name" minLength={2} maxLength={120} required /></label>
      <label>Âmbito da comunidade<textarea name="description" rows={3} maxLength={600} required /></label>
      <button className="primary" disabled={busy}>Criar comunidade</button>
      {failure && <p className="notice error" role="alert">{failure}</p>}
    </form>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">A carregar…</p> :
      data.length === 0 ? <p className="muted">Ainda não há comunidades.</p> :
        data.map((community) => <article className="panel" key={community.id}>
          <h2><Link href={`/comunidades/${community.id}`}>{community.name}</Link></h2>
          <p className="biography">{community.description}</p>
        </article>)}
  </div>;
}

export function CommunityPage({ id }: { id: string }) {
  const { data, error } = useNetworkData<Community>(`/communities/${id}`);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">A carregar a comunidade…</p>;
  return <>
    <h1>{data.name}</h1>
    <p className="biography">{data.description}</p>
    <Feed communityId={id} />
  </>;
}
