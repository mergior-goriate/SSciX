"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api, message } from "../api-client";
import { ArrowLeft, ArrowRight, FileText, Image as ImageIcon, LockKeyhole, MessageSquare, BookOpen, Paperclip, Plus, Search, Users, X, Bookmark, Heart, ImagePlus, Link as LinkIcon, MessageCircle, ChartNoAxesColumnIncreasing, Ellipsis, Send, Smile } from "lucide-react";
import Avatar from "../avatar";
import { readImage } from "../media";
import FollowButton from "../u/[slug]/follow-button";
import ReportButton from "../report-button";
import { CommunityAccess, PublicationRevisions, StoryPanel } from "../academic-ui";
import type { Profile } from "../profile-data";
import { useNetworkData } from "../use-network-data";
export { useNetworkData } from "../use-network-data";
import ReadingParticipants from "./reading-participants";

const opportunityLabels = {
  scholarship: "Bolsa",
  internship: "Estágio",
  vacancy: "Vaga",
  call: "Chamada para artigos",
} as const;
type OpportunityKind = keyof typeof opportunityLabels;
type PostKind = "post" | "collaboration" | "reading" | OpportunityKind;

function isOpportunity(kind: PostKind): kind is OpportunityKind {
  return Object.hasOwn(opportunityLabels, kind);
}

function OpportunityCategories() {
  return Object.entries(opportunityLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>);
}
type Citation = { title: string; authors: string[]; year: number | null; source: string };
type ArticleReference = Citation & { id: string; doi: string };
type ArticlePageData = ArticleReference & {
  communities: { id: string; name: string }[];
  discussions: Post[];
};

type Post = {
  id: string;
  body: string;
  author_name: string;
  author_photo: string;
  image: string;
  article_url: string;
  article_id?: string | null;
  article_citation?: Citation | null;
  likes: number;
  comments: number;
  views: number;
  liked: boolean;
  saved: boolean;
  author_slug: string;
  created_at: string;
  community_name: string | null;
  community_id: string | null;
  kind: PostKind;
  title: string;
  scheduled_date: string | null;
  resolved: boolean;
  can_resolve: boolean;
  can_edit: boolean;
};
type Community = { id: string; name: string; description: string; photo: string; can_edit_photo: boolean; is_private: boolean };

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

const emojis = ["😊", "👏", "💡", "🔬", "📚", "✅", "🤝", "🎓"];
const activityFilters = [
  { id: "collaboration", label: "Colaboração", icon: Users },
  { id: "reading", label: "Clube de leitura", icon: BookOpen },
] as const;

function Composer({ endpoint, label, communityId, opportunities, compact, profile, initialArticle, onSaved }: {
  endpoint: string; label: string; communityId?: string; opportunities?: boolean; compact?: boolean;
  profile?: Profile; initialArticle?: ArticleReference; onSaved: (kind: PostKind) => void;
}) {
  const canAttach = endpoint === "/feed";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<PostKind>(opportunities ? "scholarship" : "post");
  const [image, setImage] = useState("");
  const [article, setArticle] = useState(Boolean(initialArticle));
  const [doi, setDoi] = useState(initialArticle?.doi ?? "");
  const [reference, setReference] = useState(initialArticle);
  const [lookingUp, setLookingUp] = useState(false);
  const [showArticleLink, setShowArticleLink] = useState(false);
  const { data: communities, error: communitiesError } = useNetworkData<Community[]>(
    reference && !communityId ? "/communities" : null,
  );
  const [emojiMenu, setEmojiMenu] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const attachment = useRef<HTMLInputElement>(null);
  const titleId = useId();

  function openComposer() {
    dialog.current?.showModal();
    input.current?.focus();
  }

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

  async function lookupArticle() {
    if (!doi.trim() || lookingUp) return;
    setLookingUp(true);
    setError("");
    try {
      const result = await api<ArticleReference>("/articles/lookup", "POST", { doi });
      setReference(result);
      setDoi(result.doi);
      setShowArticleLink(false);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setLookingUp(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || lookingUp || !body.trim()) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const selectedArticle = article ? reference : undefined;
    if (article && !showArticleLink && doi.trim() && !selectedArticle) {
      setError("Consulte o DOI antes de publicar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(endpoint, "POST", {
        body: body.trim(),
        ...(canAttach ? {
          image, article_url: String(fields.get("article_url") ?? ""),
          community_id: communityId ?? (fields.get("community_id") || null),
          ...(selectedArticle ? {
            article_id: selectedArticle.id,
            article_citation: {
              title: String(fields.get("article_title") ?? "").trim(),
              authors: String(fields.get("article_authors") ?? "").split("\n").map((name) => name.trim()).filter(Boolean),
              year: fields.get("article_year") ? Number(fields.get("article_year")) : null,
              source: String(fields.get("article_source") ?? "").trim(),
            },
          } : {}),
          kind, title: String(fields.get("title") ?? ""), scheduled_date: fields.get("scheduled_date") || null,
        } : {}),
      });
      setBody("");
      setImage("");
      setArticle(Boolean(initialArticle));
      setDoi(initialArticle?.doi ?? "");
      setReference(initialArticle);
      setShowArticleLink(false);
      setEmojiMenu(false);
      setKind(opportunities ? "scholarship" : "post");
      form.reset();
      dialog.current?.close();
      onSaved(kind);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  const form = <form className={compact ? "form-stack network-composer" : "panel form-stack network-composer"} onSubmit={submit}>
    {(communityId || opportunities) && <label>{opportunities ? "Tipo de oportunidade" : "Tipo de publicação"}
      <select value={kind} disabled={busy} onChange={(event) => setKind(event.target.value as PostKind)}>
        {opportunities ? <OpportunityCategories /> : <>
          <option value="post">Publicação</option>
          <option value="collaboration">Pedido de colaboração</option>
          <option value="reading">Sessão do clube de leitura</option>
        </>}
      </select>
    </label>}
    {kind !== "post" && <label>{kind === "reading" ? "Título da leitura" : opportunities ? "Título da oportunidade" : "Título do pedido"}
      <input name="title" maxLength={120} required />
    </label>}
    {kind !== "post" && <label>{kind === "reading" ? "Data da sessão" : "Prazo (opcional)"}
      <input name="scheduled_date" type="date" min="0001-01-01" max="9999-12-31" required={kind === "reading"} />
    </label>}
    <label>{kind === "reading" ? "Plano da sessão" : kind === "collaboration" ? "Apoio necessário" : opportunities ? "Descrição da oportunidade" : canAttach ? "Criar publicação" : label}
      <textarea ref={input} name="body" rows={3} maxLength={2400} value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={opportunities ? "Indique a instituição, o local e os requisitos." : canAttach ? "Partilhe um resultado, uma pergunta ou uma proposta de colaboração." : undefined} required />
    </label>
    <small>Use @ seguido do endereço público do perfil para mencionar alguém.</small>
    {opportunities && <label>Ligação para candidatura ou submissão
      <input name="article_url" type="url" maxLength={1000} required />
    </label>}
    {article && !opportunities && <div className="form-stack article-attachment">
      {showArticleLink ? <label>Ligação para um artigo
        <input name="article_url" type="url" maxLength={1000} />
      </label> : <>
        <label>DOI do artigo
          <input value={doi} maxLength={1024} disabled={busy || lookingUp}
            onChange={(event) => { setDoi(event.target.value); setReference(undefined); }}
            placeholder="10.1234/exemplo" />
        </label>
        {!reference && <button className="secondary" type="button" disabled={busy || lookingUp || !doi.trim()}
          onClick={() => void lookupArticle()}>{lookingUp ? "A consultar…" : "Consultar DOI"}</button>}
      </>}
      {!reference && <button className="secondary" type="button" disabled={busy || lookingUp}
        onClick={() => { setShowArticleLink(!showArticleLink); setError(""); }}>
        {showArticleLink ? "Adicionar por DOI" : "Inserir ligação manualmente"}
      </button>}
      {reference && <fieldset className="form-stack article-confirmation" key={reference.id} disabled={busy}>
        <legend>Confirma os dados do artigo</legend>
        <label>Título do artigo<input name="article_title" required maxLength={1000} defaultValue={reference.title} /></label>
        <label>Autores, um por linha
          <textarea name="article_authors" rows={3} maxLength={24100} defaultValue={reference.authors.join("\n")} />
        </label>
        <label>Ano<input name="article_year" type="number" min={1} max={9999} defaultValue={reference.year ?? ""} /></label>
        <label>Revista ou fonte<input name="article_source" maxLength={300} defaultValue={reference.source} /></label>
        {!communityId && communities && <label>Publicar em
          <select name="community_id">
            <option value="">Feed geral</option>
            {communities.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>}
        {!communityId && communitiesError && <small role="status">{communitiesError} Podes publicar no feed geral.</small>}
      </fieldset>}
    </div>}
    {image && <div className="composer-preview"><img src={image} alt="Pré-visualização da imagem" />
      <button type="button" className="secondary" onClick={() => setImage("")}>Remover imagem</button></div>}
    <div className="composer-tools">
      <button className="secondary icon-action" type="button" aria-expanded={emojiMenu}
        onClick={() => setEmojiMenu(!emojiMenu)}><Smile size={18} aria-hidden="true" /> Emojis</button>
      {canAttach && <>
        <label className="secondary attachment-label"><ImagePlus size={18} aria-hidden="true" /> Imagem
          <input ref={attachment} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
            onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        {!opportunities && <button className="secondary icon-action" type="button" aria-expanded={article}
          disabled={busy || lookingUp} onClick={() => {
            setArticle(!article);
            if (article) {
              setDoi("");
              setReference(undefined);
              setShowArticleLink(false);
              setError("");
            }
          }}><LinkIcon size={18} aria-hidden="true" /> {article ? "Remover artigo" : "Adicionar artigo"}</button>}
      </>}
      <button className="primary" disabled={busy || lookingUp}>{label}</button>
    </div>
    {emojiMenu && <div className="emoji-options" role="group" aria-label="Escolher emoji">
      {emojis.map((emoji) => <button className="secondary" key={emoji} type="button" onClick={() => insertEmoji(emoji)}>{emoji}</button>)}
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </form>;

  if (!compact) return form;

  const firstName = profile?.name.trim().split(/\s+/)[0];
  return <>
    <div className="panel feed-quick-entry">
      <Avatar name={profile?.name || "Meu perfil"} photo={profile?.photo} />
      <button className="feed-quick-prompt" aria-label="Criar publicação" type="button" onClick={openComposer}>
        {firstName ? `O que queres partilhar, ${firstName}?` : "O que queres partilhar?"}
      </button>
      <button className="feed-quick-action" type="button" aria-label="Adicionar imagem à publicação" title="Adicionar imagem"
        onClick={() => { openComposer(); attachment.current?.click(); }}>
        <ImagePlus size={21} aria-hidden="true" />
      </button>
      <button className="feed-quick-action" type="button" aria-label="Adicionar ligação para um artigo" title="Adicionar artigo"
        onClick={() => { setArticle(true); openComposer(); }}>
        <Paperclip size={20} aria-hidden="true" />
      </button>
    </div>
    <dialog className="panel community-dialog feed-dialog" ref={dialog} aria-labelledby={titleId}>
      <header>
        <h2 id={titleId}>Criar publicação</h2>
        <button className="secondary" type="button" aria-label="Fechar" onClick={() => dialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {form}
    </dialog>
  </>;
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

const compactCount = new Intl.NumberFormat("pt-MZ", { notation: "compact", maximumFractionDigits: 1 });

function PostActions({ post, onChange, report }: { post: Post; onChange?: () => void; report?: boolean }) {
  const path = `/feed/${post.id}/actions`;
  const [actions, setActions] = useState<Actions>({ liked: post.liked, saved: post.saved, likes: post.likes });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [animatedAction, setAnimatedAction] = useState<"like" | "save">();

  async function toggle(action: "like" | "save", value: boolean) {
    setBusy(true);
    setFeedback("");
    setAnimatedAction(undefined);
    try {
      setActions(await api<Actions>(`${path}/${action}`, value ? "DELETE" : "PUT"));
      setAnimatedAction(action);
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
    setShareUrl("");
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Ligação copiada.");
    } catch {
      setShareUrl(url);
    }
  }

  const saveLabel = actions.saved ? (onChange ? "Remover dos guardados" : "Guardado") : "Guardar";
  const commentLabel = post.comments === 1 ? "1 comentário" : `${post.comments} comentários`;
  const viewsLabel = post.views === 1 ? "1 visualização da publicação" : `${post.views} visualizações da publicação`;

  return <>
    <div className="post-actions" role="group" aria-label="Interacções da publicação">
      <button type="button" aria-pressed={actions.liked} data-confirmed={animatedAction === "like" || undefined}
        aria-label={`Gostar · ${actions.likes} ${actions.likes === 1 ? "gosto" : "gostos"}`} title="Gostar"
        disabled={busy} onClick={() => void toggle("like", actions.liked)}>
        <Heart size={20} aria-hidden="true" />{compactCount.format(actions.likes)}
      </button>
      <Link href={`/rede/${post.id}#comentarios`} aria-label={`Comentar · ${commentLabel}`} title={commentLabel}>
        <MessageCircle size={20} aria-hidden="true" />{compactCount.format(post.comments)}
      </Link>
      <span className="post-views" role="img" aria-label={viewsLabel} title={viewsLabel}>
        <ChartNoAxesColumnIncreasing size={20} aria-hidden="true" />{compactCount.format(post.views)}
      </span>
      <button type="button" aria-pressed={actions.saved} data-confirmed={animatedAction === "save" || undefined}
        aria-label={saveLabel} title={actions.saved ? "Remover dos guardados" : "Guardar"}
        disabled={busy} onClick={() => void toggle("save", actions.saved)}>
        <Bookmark size={20} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Partilhar" title="Partilhar" onClick={() => void share()}>
        <Send size={20} aria-hidden="true" />
      </button>
      {report && <details className="post-more">
        <summary aria-label="Mais opções" title="Mais opções"><Ellipsis size={21} aria-hidden="true" /></summary>
        <div className="panel post-more-options">
          <ReportButton kind="post" id={post.id} />
          {(post.image || post.article_url) && <ReportButton kind="attachment" id={post.id} label="Denunciar anexo" />}
        </div>
      </details>}
    </div>
    {shareUrl && <label>Ligação para partilhar<input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}
    {feedback && <p className="muted" role="status">{feedback}</p>}
  </>;
}

function citationByline(citation: Citation, compact = false) {
  const authors = compact && citation.authors.length > 3
    ? citation.authors.slice(0, 3).join(", ") + " et al."
    : citation.authors.join(", ");
  return [authors, citation.year, citation.source].filter(Boolean).join(" · ");
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
    {post.kind !== "post" && post.title && <div className="post-activity">
      <p className="muted">{isOpportunity(post.kind) ? `${opportunityLabels[post.kind]}${post.resolved ? " · Encerrada" : ""}` :
        post.kind === "reading" ? "Clube de leitura" : post.resolved ? "Colaboração resolvida" : "Pedido de colaboração em aberto"}</p>
      <h2><Link href={`/rede/${post.id}`}>{post.title}</Link></h2>
      {post.scheduled_date && <time dateTime={post.scheduled_date}>
        {post.kind === "reading" ? "Sessão a " : "Prazo até "}
        {post.scheduled_date.split("-").reverse().join("/")}
      </time>}
    </div>}
    <p className="biography">{post.body}</p>
    {post.image && <img className="post-image" src={post.image} alt="Imagem anexada à publicação" loading="lazy" />}
    {post.article_id && post.article_citation && <Link className="post-article-card" href={`/artigos/${post.article_id}`}>
      <FileText size={20} aria-hidden="true" />
      <span><strong>{post.article_citation.title}</strong>
        <small>{citationByline(post.article_citation, true)}</small>
      </span>
    </Link>}
    {!post.article_id && post.article_url && <a className="icon-action" href={post.article_url} rel="noopener noreferrer" target="_blank">
      <LinkIcon size={17} aria-hidden="true" /> {isOpportunity(post.kind) ? "Consultar anúncio" : "Abrir artigo"}
    </a>}
    {topic ? <PostActions post={post} onChange={onChange} report /> : <div className="profile-actions report-actions">
      <ReportButton kind="post" id={post.id} />
      {(post.image || post.article_url) && <ReportButton kind="attachment" id={post.id} label="Denunciar anexo" />}
    </div>}
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

export function ArticleDiscussions({ id }: { id: string }) {
  const [community, setCommunity] = useState("");
  const [page, setPage] = useState(0);
  const [sharing, setSharing] = useState(false);
  const params = new URLSearchParams({ offset: String(page * feedPageSize), page_size: String(feedPageSize + 1) });
  if (community) params.set("community_id", community);
  const { data, error, refresh } = useNetworkData<ArticlePageData>(`/articles/${id}?${params}`);

  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!data) return <p role="status">A carregar o artigo…</p>;

  return <div className="network-stack">
    <header className="panel network-post">
      <h1>{data.title}</h1>
      <p className="muted">{citationByline(data)}</p>
      <div className="profile-actions">
        <a className="secondary" href={`https://doi.org/${data.doi.split("/").map(encodeURIComponent).join("/")}`}
          target="_blank" rel="noopener noreferrer">Abrir artigo pelo DOI</a>
        <button className="secondary" type="button" aria-expanded={sharing}
          onClick={() => setSharing(!sharing)}>Partilhar artigo na SSciX</button>
      </div>
    </header>
    {sharing && <Composer endpoint="/feed" label="Publicar" initialArticle={data}
      onSaved={() => { setSharing(false); setCommunity(""); setPage(0); refresh(); }} />}
    <section className="network-stack" aria-labelledby="article-discussions-title">
      <h2 id="article-discussions-title">Debates sobre o artigo</h2>
      {(data.communities.length > 0 || community) && <label>Comunidade
        <select value={community} onChange={(event) => { setCommunity(event.target.value); setPage(0); }}>
          <option value="">Todos os debates</option>
          {community && !data.communities.some(({ id }) => id === community) &&
            <option value={community}>Comunidade indisponível</option>}
          {data.communities.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>}
      <Posts data={data.discussions.slice(0, feedPageSize)} error="" empty="Sem debates neste filtro." topic />
      {(page > 0 || data.discussions.length > feedPageSize) && <nav className="profile-actions" aria-label="Páginas de debates">
        <button type="button" className="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button>
        <button type="button" className="secondary" disabled={data.discussions.length <= feedPageSize || page >= 5000}
          onClick={() => setPage(page + 1)}>Seguinte</button>
      </nav>}
    </section>
  </div>;
}

const attachmentFilters = [
  { id: "articles", label: "Com artigo", icon: FileText },
  { id: "images", label: "Com imagem", icon: ImageIcon },
] as const;

type AttachmentFilter = "all" | (typeof attachmentFilters)[number]["id"];
type PostFilter = AttachmentFilter | (typeof activityFilters)[number]["id"];

function filterPosts(posts: Post[] | undefined, filter: AttachmentFilter) {
  if (filter === "all") return posts;
  return posts?.filter((post) => filter === "articles" ? post.article_url && !isOpportunity(post.kind) : post.image);
}

const savedFilters = [{ id: "all", label: "Todas", icon: Bookmark }, ...attachmentFilters] as const;

export function SavedPosts() {
  const { data, error, refresh } = useNetworkData<Post[]>("/saved");
  const [filter, setFilter] = useState<AttachmentFilter>("all");
  const visible = filterPosts(data, filter);

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
                      <LinkIcon size={16} aria-hidden="true" /> {isOpportunity(post.kind) ? "Consultar anúncio" : "Abrir artigo"}
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

const feedPageSize = 20;

export function Feed({ communityId, opportunities, initialQuery = "" }: { communityId?: string; opportunities?: boolean; initialQuery?: string }) {
  const mainFeed = !communityId && !opportunities;
  const [category, setCategory] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [openOnly, setOpenOnly] = useState(true);
  const [following, setFollowing] = useState(false);
  const [filter, setFilter] = useState<PostFilter>("all");
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState(initialQuery);
  const [order, setOrder] = useState<"recent" | "popular" | "deadline" | "interests">(
    mainFeed && !initialQuery ? "interests" : "recent",
  );
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({ order, offset: String(page * feedPageSize), page_size: String(feedPageSize + 1) });
  if (communityId) params.set("community_id", communityId);
  else if (following) params.set("following", "true");
  if (opportunities) {
    params.set("content", "opportunities");
    if (category) params.set("opportunity_kind", category);
    if (openOnly) params.set("open_only", "true");
    if (savedOnly) params.set("saved_only", "true");
    if (deadline) params.set("deadline_days", deadline);
  } else if (filter !== "all") params.set("content", filter);
  if (query) params.set("q", query);
  const { data, error, refresh } = useNetworkData<Post[]>(`/feed?${params}`);
  const { data: profile } = useNetworkData<Profile>(mainFeed ? "/profiles/me" : null);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = draft.trim();
    if (term) void api("/activity", "POST", { query: term }).catch(() => undefined);
    setQuery(term);
    setPage(0);
  }

  return <div className="network-stack">
    <Composer endpoint="/feed" communityId={communityId} opportunities={opportunities} compact={mainFeed} profile={profile} label={opportunities ? "Publicar oportunidade" : "Publicar"} onSaved={(kind) => {
      setFollowing(false);
      setQuery("");
      setDraft("");
      setOrder("recent");
      setPage(0);
      setFilter(kind === "collaboration" || kind === "reading" ? kind : "all");
      setCategory("");
      setSavedOnly(false);
      setDeadline("");
      refresh();
    }} />
    {mainFeed && <StoryPanel profile={profile} />}
    <form className="panel feed-search-tools" onSubmit={search} role="search" aria-label="Pesquisar publicações">
      <label>Pesquisar publicações
        <input type="search" maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder="Termo no título ou no texto" />
      </label>
      <button className="secondary" type="submit"><Search size={16} aria-hidden="true" />Pesquisar</button>
      <label>Ordenar por
        <select value={order} onChange={(event) => {
          const value = event.target.value;
          setOrder(value === "popular" || value === "deadline" || value === "interests" ? value : "recent");
          setPage(0);
        }}>
          {mainFeed && <option value="interests">Para ti</option>}
          <option value="recent">Mais recentes</option>
          <option value="popular">Mais gostos</option>
          {opportunities && <option value="deadline">Prazo mais próximo</option>}
        </select>
      </label>
    </form>
    {query && <div className="feed-active-search">
      <span>Resultados para «{query}»</span>
      <button className="secondary" type="button" onClick={() => { setQuery(""); setDraft(""); setPage(0); }}>Limpar pesquisa</button>
    </div>}
    {opportunities && <div className="panel opportunity-filters">
      <label>Categoria
        <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}>
          <option value="">Todas as categorias</option>
          <OpportunityCategories />
        </select>
      </label>
      <label>Prazo de candidatura
        <select value={deadline} onChange={(event) => { setDeadline(event.target.value); setPage(0); }}>
          <option value="">Qualquer prazo</option>
          <option value="7">Até 7 dias</option>
          <option value="30">Até 30 dias</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={savedOnly}
        onChange={(event) => { setSavedOnly(event.target.checked); setPage(0); }} />Só as minhas guardadas</label>
      <label className="check"><input type="checkbox" checked={openOnly || Boolean(deadline)} disabled={Boolean(deadline)}
        onChange={(event) => { setOpenOnly(event.target.checked); setPage(0); }} />Só oportunidades em aberto</label>
    </div>}
    {!opportunities && !communityId && <div className="feed-filters" role="group" aria-label="Filtrar publicações">
      <button className="secondary" aria-pressed={!following} onClick={() => { setFollowing(false); setPage(0); }}>Todas as pessoas</button>
      <button className="secondary" aria-pressed={following} onClick={() => { setFollowing(true); setPage(0); }}>Pessoas que sigo</button>
    </div>}
    {!opportunities && <div className="feed-filters feed-content-filters" role="group" aria-label="Filtrar por tipo de publicação">
      <button className="secondary" type="button" aria-pressed={filter === "all"}
        onClick={() => { setFilter("all"); setPage(0); }}>Todas</button>
      {[...attachmentFilters, ...activityFilters].map(({ id, label, icon: Icon }) => (
        <button className="secondary icon-action" key={id} type="button" aria-pressed={filter === id}
          onClick={() => { setFilter(id); setPage(0); }}><Icon size={16} aria-hidden="true" />{label}</button>
      ))}
    </div>}
    {communityId && !query && page === 0 && filter === "all" && data?.length === 0 ? <div className="panel community-empty" role="status">
      <MessageSquare size={25} aria-hidden="true" />
      <strong>Ainda não há debates nesta comunidade.</strong>
      <p>Publique uma pergunta, um resultado ou uma proposta de colaboração.</p>
    </div> : <Posts data={data?.slice(0, feedPageSize)} error={error}
      empty={query ? "Nenhuma publicação corresponde à pesquisa." : opportunities ? "Nenhuma oportunidade nestes filtros." : "Nenhuma publicação nesta página."} topic onChange={savedOnly ? refresh : undefined} />}
    {(page > 0 || (data?.length ?? 0) > feedPageSize) && (
      <nav className="feed-filters" aria-label="Páginas de publicações">
        <button className="secondary" type="button" disabled={page === 0}
          onClick={() => setPage(page - 1)}>Anterior</button>
        <span aria-live="polite">Página {page + 1}</span>
        <button className="secondary" type="button" disabled={(data?.length ?? 0) <= feedPageSize || page >= 5000}
          onClick={() => setPage(page + 1)}>Seguinte</button>
      </nav>
    )}
  </div>;
}

export function Topic({ id }: { id: string }) {
  const topic = useNetworkData<Post>(`/feed/${id}`);
  const replies = useNetworkData<Post[]>(`/feed/${id}/replies`);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const loadedId = topic.data?.id;
  useEffect(() => {
    if (loadedId) void api("/activity", "POST", { post_id: loadedId }).catch(() => undefined);
  }, [loadedId]);
  if (topic.error) return <p role="alert">{topic.error}</p>;
  if (!topic.data) return <p role="status">A carregar o debate…</p>;

  async function resolve() {
    setResolving(true);
    setResolveError("");
    try {
      await api(`/feed/${id}/resolved`, "PUT");
      topic.refresh();
    } catch (failure) {
      setResolveError(message(failure));
    } finally {
      setResolving(false);
    }
  }

  return <div className="network-stack">
    <PostCard post={topic.data} topic />
    <PublicationRevisions id={id} body={topic.data.body} canEdit={topic.data.can_edit} onSaved={topic.refresh} />
    {topic.data.can_resolve && !topic.data.resolved &&
      <button className="secondary" type="button" disabled={resolving} onClick={() => void resolve()}>{isOpportunity(topic.data.kind) ? "Encerrar oportunidade" : "Marcar como resolvido"}</button>}
    {resolveError && <p className="notice error" role="alert">{resolveError}</p>}
    {topic.data.kind === "reading" && <ReadingParticipants postId={id} />}
    <h2 id="comentarios">Comentários</h2>
    <Posts data={replies.data} error={replies.error} empty="Ainda não há respostas." />
    <Composer endpoint={`/feed/${id}/replies`} label="Comentar" onSaved={() => { replies.refresh(); topic.refresh(); }} />
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
      const { photo_file, is_private, ...fields } = Object.fromEntries(new FormData(form));
      const photo = photo_file instanceof File && photo_file.size ? await readImage(photo_file, 260 * 1024) : "";
      await api("/communities", "POST", { ...fields, photo, is_private: Boolean(is_private) });
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
        <label><input name="is_private" type="checkbox" /> Comunidade privada</label>
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
            {data.is_private && data.can_edit_photo && <CommunityAccess id={id} />}
        <Feed communityId={id} />
          </section>
          <aside className="panel community-guide community-about">
            <h2><BookOpen size={20} aria-hidden="true" /> Sobre a comunidade</h2>
            <p className="biography muted">{data.description}</p>
            <Link href="/ajuda#comunidades">Políticas das comunidades</Link>
            <ReportButton kind="community" id={id} label="Denunciar comunidade" />
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
