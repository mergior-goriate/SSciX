"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, message } from "../api-client";

type Post = {
  id: string;
  body: string;
  author_name: string;
  author_slug: string;
  created_at: string;
  community_name: string | null;
  community_id: string | null;
};
type Community = { id: string; name: string; description: string };

function useNetworkData<T>(path: string) {
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
  }, [path, version]);

  return { data, error, refresh: () => setVersion((value) => value + 1) };
}

function Composer({ endpoint, label, communityId, onSaved }: {
  endpoint: string; label: string; communityId?: string; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    setBusy(true);
    setError("");
    try {
      await api(endpoint, "POST", { body, ...(communityId ? { community_id: communityId } : {}) });
      form.reset();
      onSaved();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <form className="panel form-stack" onSubmit={submit}>
    <label>{label}<textarea name="body" rows={3} maxLength={2400} required /></label>
    <button className="primary" disabled={busy}>{label}</button>
    {error && <p className="notice error" role="alert">{error}</p>}
  </form>;
}

function PostCard({ post, link }: { post: Post; link?: boolean }) {
  return <article className="panel network-post">
    <header>
      <Link href={`/u/${post.author_slug}`}><strong>{post.author_name}</strong></Link>
      <time className="muted" dateTime={post.created_at}>{post.created_at.slice(0, 10)}</time>
    </header>
    {post.community_id && <Link href={`/comunidades/${post.community_id}`}>{post.community_name}</Link>}
    <p className="biography">{post.body}</p>
    {link && <Link href={`/rede/${post.id}`}>Abrir debate</Link>}
  </article>;
}

function Posts({ data, error, empty, link }: { data?: Post[]; error: string; empty: string; link?: boolean }) {
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!data) return <p role="status">A carregar…</p>;
  if (!data.length) return <p className="muted">{empty}</p>;
  return data.map((post) => <PostCard key={post.id} post={post} link={link} />);
}

export function Feed({ communityId }: { communityId?: string }) {
  const [following, setFollowing] = useState(false);
  const path = communityId ? `/feed?community_id=${communityId}` : `/feed?following=${following}`;
  const { data, error, refresh } = useNetworkData<Post[]>(path);

  return <div className="network-stack">
    {!communityId && <div className="profile-actions" aria-label="Filtrar publicações">
      <button className="secondary" aria-pressed={!following} onClick={() => setFollowing(false)}>Publicações recentes</button>
      <button className="secondary" aria-pressed={following} onClick={() => setFollowing(true)}>Pessoas que sigo</button>
    </div>}
    <Composer endpoint="/feed" communityId={communityId} label="Publicar" onSaved={() => {
      if (following) setFollowing(false);
      refresh();
    }} />
    <Posts data={data} error={error} empty="Ainda não há publicações para mostrar." link />
  </div>;
}

export function Topic({ id }: { id: string }) {
  const topic = useNetworkData<Post>(`/feed/${id}`);
  const replies = useNetworkData<Post[]>(`/feed/${id}/replies`);
  if (topic.error) return <p role="alert">{topic.error}</p>;
  if (!topic.data) return <p role="status">A carregar o debate…</p>;

  return <div className="network-stack">
    <PostCard post={topic.data} />
    <h2>Respostas</h2>
    <Posts data={replies.data} error={replies.error} empty="Ainda não há respostas." />
    <Composer endpoint={`/feed/${id}/replies`} label="Responder" onSaved={replies.refresh} />
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
