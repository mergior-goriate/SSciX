"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, message } from "../api-client";

type Access = { role: "admin" | "moderator" | "viewer"; community_id: string | null; user_id: string };
const tabs = {
  metrics: "Visão geral", users: "Utilizadores e perfis", communities: "Comunidades", posts: "Publicações",
  comments: "Comentários", attachments: "Anexos", reports: "Denúncias", audit: "Auditoria",
} as const;
type Tab = keyof typeof tabs;
type Row = Record<string, unknown>;
type Records = { items: Row[]; more: boolean };
type Metric = Record<string, number | null>;
type Metrics = {
  totals: Metric; previous: Metric; series: ({ date: string } & Record<string, string | number | null>)[];
  definitions: Record<string, string>; start: string; end: string; previous_start: string; previous_end: string;
  collection_started_at: string | null; updated_at: string; community_id: string | null;
};
const labels: Record<string, string> = {
  logins: "Entradas", sessions: "Sessões criadas", visits: "Visitas autenticadas", views: "Visualizações",
  post_views: "Visualizações de publicações", community_views: "Visualizações de comunidades",
  unique_post_views: "Visualizações únicas de publicações", unique_community_views: "Visualizações únicas de comunidades",
  unique_viewers: "Visitantes únicos", active: "Contas activas", days_per_user: "Dias activos por conta",
  return_rate: "Regresso (%)", registrations: "Registos", posts: "Publicações", comments: "Comentários",
  collaborations: "Pedidos de colaboração", reading: "Sessões de leitura", opportunities: "Oportunidades",
  reports_received: "Denúncias recebidas", reports_pending: "Denúncias pendentes", reports_closed: "Denúncias encerradas",
  median_hours: "Resolução mediana (h)", admin_actions: "Acções administrativas", messages: "Mensagens privadas",
  contributors: "Autores distintos", reactions: "Reacções actuais", follows: "Seguimentos actuais",
  bookmarks: "Guardados actuais", mentions: "Menções actuais", reading_participants: "Inscrições em leituras",
  dau: "Activos no último dia", wau: "Activos nos últimos 7 dias", mau: "Activos nos últimos 30 dias",
};
const states: Record<string, string> = { pending: "Pendente", reviewing: "Em análise", resolved: "Resolvida", dismissed: "Arquivada" };
const priorities: Record<string, string> = { low: "Baixa", normal: "Normal", high: "Alta" };
const roles: Record<string, string> = { admin: "Administrador", moderator: "Moderador", viewer: "Consulta" };
const targets: Record<string, string> = { profile: "Perfil", community: "Comunidade", post: "Publicação ou comentário",
  attachment: "Anexo", message: "Mensagem privada", report: "Denúncia", account: "Conta", user: "Utilizador", metrics: "Indicadores" };
const types: Record<string, string> = { post: "Publicação", collaboration: "Colaboração", reading: "Leitura",
  scholarship: "Bolsa", internship: "Estágio", vacancy: "Vaga", call: "Chamada para artigos" };
const text = (row: Row, key: string) => typeof row[key] === "string" ? row[key] as string : "";
const number = new Intl.NumberFormat("pt-MZ", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-MZ", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Maputo" });
const showDate = (value?: string | null) => value ? date.format(new Date(value)) : "—";
const amount = (value: number | null | undefined) => value == null ? "—" : number.format(value);

function useRequest<T>(path: string, revision = 0) {
  const [state, setState] = useState<{ path: string; revision: number; data?: T; error?: string; status?: number }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path).then(data => { if (active) setState({ path, revision, data }); })
      .catch(failure => { if (active) setState({ path, revision, error: message(failure), status: failure?.status }); });
    return () => { active = false; };
  }, [path, revision]);
  return state?.path === path && state.revision === revision ? state : undefined;
}

function Feedback({ error, loading }: { error?: string; loading: boolean }) {
  if (error) return <p role="alert" className="notice error">{error}</p>;
  if (loading) return <p role="status">A carregar…</p>;
  return null;
}

function Options({ values }: { values: Record<string, string> }) {
  return Object.entries(values).map(([key, value]) => <option value={key} key={key}>{value}</option>);
}

function MetricsPanel({ grant, communities, openReports }: { grant: Access; communities: Row[]; openReports: (filters: string) => void }) {
  const [filters, setFilters] = useState("");
  const [chart, setChart] = useState("views");
  const result = useRequest<Metrics>(`/admin/metrics?${filters}`);
  const data = result?.data;
  const high = Math.max(1, ...(data?.series.map(row => Number(row[chart] ?? 0)) ?? []));
  const cards = ["logins", "sessions", "visits", "views", "unique_viewers", "days_per_user", "return_rate", "reports_pending"];
  return <>
    <h1>Visão geral</h1>
    <form className="panel admin-filters" onSubmit={(event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setFilters(new URLSearchParams(Array.from(fields, ([key, value]) => [key, String(value)]).filter(([, value]) => value)).toString());
    }}>
      <label>Início<input name="start" type="date" /></label>
      <label>Fim<input name="end" type="date" /></label>
      <label>Comunidade<select name="community_id" defaultValue={grant.community_id ?? ""}>
        {grant.role !== "moderator" && <option value="">Toda a rede</option>}
        {communities.map(row => <option value={text(row, "id")} key={text(row, "id")}>{text(row, "name")}</option>)}
      </select></label>
      <label>Tipo de conteúdo<select name="content_type"><option value="">Todos</option><Options values={types} /></select></label>
      <button className="primary">Aplicar filtros</button>
    </form>
    <Feedback error={result?.error} loading={!result} />
    {data && <>
      <div className="admin-period">
        <p>{data.start} a {data.end} · Actualizado em {showDate(data.updated_at)}<br />
          Recolha de eventos desde {showDate(data.collection_started_at)} · Hora de Maputo</p>
        <a className="secondary" href={`/api/v1/admin/metrics?format=csv&${filters}`} download>Exportar CSV</a>
      </div>
      <div className="admin-metrics">{cards.map(key =>
        <article className="panel" key={key}>
          <h2>{labels[key]}</h2><strong>{amount(data.totals[key])}</strong>
          <small>Período anterior {amount(data.previous[key])}</small>
          {key === "reports_pending" && <button type="button" onClick={() => {
            const params = new URLSearchParams({ state: "open", start: data.start, end: data.end });
            if (data.community_id) params.set("community_id", data.community_id);
            openReports(params.toString());
          }}>Abrir fila pendente</button>}
        </article>)}</div>
      <section className="panel">
        <h2>Evolução diária</h2>
        <label>Indicador<select value={chart} onChange={event => setChart(event.target.value)}>
          <Options values={Object.fromEntries(["views", "active", "posts", "comments", "registrations", "reports_received", "reports_closed"]
            .map(key => [key, labels[key]]))} />
        </select></label>
        {data.series.every(row => row[chart] == null) ? <p className="muted">Sem dados para este indicador no período.</p> :
          <div className="admin-chart" aria-label={`Gráfico diário de ${labels[chart]}`}>
            {data.series.map(row => <div key={row.date} title={`${row.date} · ${amount(row[chart] as number | null)}`}>
              <span style={{ height: `${100 * Number(row[chart] ?? 0) / high}%` }} />
            </div>)}
          </div>}
        <details><summary>Consultar valores por dia</summary><div className="admin-table">
          <table><thead><tr><th>Data</th><th>{labels[chart]}</th></tr></thead><tbody>
            {data.series.map(row => <tr key={row.date}><td>{row.date}</td><td>{amount(row[chart] as number | null)}</td></tr>)}
          </tbody></table>
        </div></details>
      </section>
      <section className="panel"><h2>Indicadores detalhados</h2>
        <p className="muted">Comparação com {data.previous_start} a {data.previous_end}. Um traço assinala dados indisponíveis ou um indicador sem denominador.</p>
        <div className="admin-table"><table><thead><tr><th>Indicador e definição</th><th>Período</th><th>Anterior</th></tr></thead>
          <tbody>{Object.entries(data.totals).map(([key, value]) => <tr key={key}>
            <th scope="row">{labels[key]}<small>{data.definitions[key]}</small></th>
            <td>{amount(value)}</td><td>{amount(data.previous[key])}</td>
          </tr>)}</tbody></table></div>
      </section>
    </>}
  </>;
}

type Action = {
  title: string;
  endpoint: string;
  fields?: ReactNode;
  data: (form: FormData) => object;
};

function Decision({ action, close, completed }: { action: Action; close: () => void; completed: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setBusy(true);
    try {
      await api(action.endpoint, "PUT", { ...action.data(form), reason: form.get("reason") });
      completed();
    } catch (failure) {
      setError(message(failure));
    } finally { setBusy(false); }
  }
  return <dialog className="panel admin-dialog" ref={dialog} aria-labelledby="action-title" onCancel={event => {
    event.preventDefault();
    if (!busy) close();
  }}>
    <form onSubmit={submit} className="form-stack">
      <h2 id="action-title">{action.title}</h2>
      {action.fields}
      <label>Motivo<textarea name="reason" minLength={3} maxLength={1200} required /></label>
      <label className="check"><input type="checkbox" required /> Confirmo a acção indicada.</label>
      <Feedback error={error} loading={busy} />
      <div className="profile-actions">
        <button className="primary" disabled={busy}>Confirmar</button>
        <button className="secondary" type="button" disabled={busy} onClick={close}>Cancelar</button>
      </div>
    </form>
  </dialog>;
}

function RecordName({ row, tab }: { row: Row; tab: Tab }) {
  if (tab === "audit") return <>{text(row, "action")} · {targets[text(row, "target_type")]}</>;
  if (tab === "reports") return <>{targets[text(row, "target_type")]} · {states[text(row, "state")]}</>;
  return <>{text(row, "name") || text(row, "title") || (tab === "comments" ? "Comentário" : types[text(row, "kind")])}</>;
}

function ReportDetail({ id, grant, revision, edit }: { id: string; grant: Access; revision: number; edit: (action: Action) => void }) {
  const result = useRequest<Row>(`/admin/reports/${id}`, revision);
  const row = result?.data;
  const community = row && text(row, "community_id");
  const assignees = useRequest<{ id: string; name: string }[]>(row && grant.role !== "viewer" ?
    `/admin/assignees?${community ? `community_id=${community}` : ""}` : "");
  if (!row) return <Feedback error={result?.error} loading={!result} />;
  const target = text(row, "target_type");
  const history = Array.isArray(row.history) ? row.history as Row[] : [];
  return <>
    <dl className="admin-detail">
      <dt>Estado</dt><dd>{states[text(row, "state")]}</dd>
      <dt>Prioridade</dt><dd>{priorities[text(row, "priority")]}</dd>
      <dt>Motivo apresentado</dt><dd>{text(row, "reason")}</dd>
      <dt>Conteúdo denunciado</dt><dd>{text(row, "content") || "Conteúdo indisponível ou sem texto."}</dd>
    </dl>
    {text(row, "link") && <p><Link href={text(row, "link")}>Abrir na rede</Link></p>}
    {target === "attachment" && row.has_image === true && <img className="admin-attachment"
      src={`/api/v1/admin/attachment/${text(row, "target_id")}`} alt="Imagem denunciada" />}
    {grant.role !== "viewer" && (
      <div className="profile-actions">
        <button className="primary" type="button" onClick={() => edit({
          title: "Registar decisão da denúncia", endpoint: `/admin/reports/${id}`,
          fields: <>
            <label>Estado<select name="state" defaultValue={text(row, "state")}><Options values={states} /></select></label>
            <label>Prioridade<select name="priority" defaultValue={text(row, "priority")}><Options values={priorities} /></select></label>
            <label>Responsável<select name="assignee_id" defaultValue={text(row, "assignee_id")}>
              <option value="">Sem responsável</option>
              {assignees?.data?.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select></label>
            <Feedback error={assignees?.error} loading={false} />
          </>,
          data: fields => ({ state: fields.get("state"), priority: fields.get("priority"), assignee_id: fields.get("assignee_id") || null }),
        })}>Registar decisão</button>
        {(target === "post" || target === "attachment" || (grant.role === "admin" && ["community", "profile"].includes(target))) &&
          <button className="secondary" type="button" onClick={() => edit({
            title: "Ocultar conteúdo denunciado", endpoint: `/admin/moderation/${target}/${text(row, "target_id")}`,
            data: () => ({ enabled: true }),
          })}>Ocultar conteúdo</button>}
      </div>
    )}
    <h3>Histórico do caso</h3>
    {history.length ? <ul className="admin-history">{history.map((entry, index) => <li key={index}>
      <strong>{text(entry, "action")}</strong> · {showDate(text(entry, "created_at"))}
      <p>{text(entry, "reason")}</p>
      <small>{text(entry, "actor_id")} · {text(entry, "previous")} → {text(entry, "result")}</small>
    </li>)}</ul> : <p className="muted">Ainda não há decisões registadas.</p>}
  </>;
}

function Manage({ tab, grant, communities, initialFilters }: {
  tab: Exclude<Tab, "metrics">; grant: Access; communities: Row[]; initialFilters: string;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const initial = new URLSearchParams(initialFilters);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Row>();
  const [action, setAction] = useState<Action>();
  const [saved, setSaved] = useState(false);
  const result = useRequest<Records>(`/admin/records/${tab}?offset=${page * 25}&${filters}`, revision);
  const id = selected ? text(selected, "id") : "";
  const historyPath = selected && tab !== "reports" && tab !== "audit"
    ? `/admin/records/audit?target_id=${id}` : "";
  const history = useRequest<Records>(historyPath, revision);

  function moderate(kind: string, enabled: boolean, title: string) {
    setAction({ title, endpoint: `/admin/moderation/${kind}/${id}`, data: () => ({ enabled }) });
  }
  function refresh() {
    setAction(undefined);
    setRevision(value => value + 1);
    setSaved(true);
    if (tab !== "reports") setSelected(undefined);
  }
  return <>
    <h1>{tabs[tab]}</h1>
    <form className="panel admin-filters" onSubmit={(event) => {
      event.preventDefault();
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(event.currentTarget)) if (value) params.set(key, String(value));
      setPage(0);
      setSelected(undefined);
      setFilters(params.toString());
    }}>
      <label>Pesquisar<input name="q" type="search" maxLength={100} /></label>
      {tab === "users" && <label>Estado da conta<select name="account_state">
        <option value="">Todos</option>
        <option value="active">Activa</option><option value="suspended">Suspensa</option>
        <option value="deactivated">Desactivada</option><option value="unverified">Por confirmar</option>
      </select></label>}
      {tab !== "users" && <label>Comunidade<select name="community_id" defaultValue={initial.get("community_id") ?? grant.community_id ?? ""}>
        {grant.role !== "moderator" && <option value="">Todas</option>}
        {communities.map(row => <option value={text(row, "id")} key={text(row, "id")}>{text(row, "name")}</option>)}
      </select></label>}
      {tab === "reports" && <>
        <label>Início<input name="start" type="date" defaultValue={initial.get("start") ?? ""} /></label>
        <label>Fim<input name="end" type="date" defaultValue={initial.get("end") ?? ""} /></label>
        <label>Estado<select name="state" defaultValue={initial.get("state") ?? ""}><option value="">Todos</option><option value="open">Pendentes ou em análise</option><Options values={states} /></select></label>
        <label>Prioridade<select name="priority"><option value="">Todas</option><Options values={priorities} /></select></label>
      </>}
      <button className="primary">Filtrar</button>
    </form>
    {saved && <p role="status" className="notice">Decisão guardada na auditoria.</p>}
    <Feedback error={result?.error} loading={!result} />
    {result?.data && <section className="panel">
      {!result.data.items.length ? <p>Sem registos para os filtros seleccionados.</p> :
        <div className="admin-table"><table><thead><tr><th>Registo</th><th>Detalhe</th><th>Acção</th></tr></thead><tbody>
          {result.data.items.map(row => <tr key={text(row, "id")}>
            <th scope="row"><RecordName row={row} tab={tab} /></th>
            <td>{tab === "users" ? `${text(row, "email")} · ${row.suspended ? "Suspensa" : row.deactivated_at ? "Desactivada" : row.verified_at ? "Activa" : "Por confirmar"}` :
              tab === "reports" ? `${priorities[text(row, "priority")]} · ${showDate(text(row, "created_at"))}` :
              tab === "communities" ? `${row.posts} publicações · ${row.contributors} autores` :
              [text(row, "author"), showDate(text(row, "created_at"))].filter(Boolean).join(" · ")}</td>
            <td><button className="secondary" onClick={() => { setSelected(row); setSaved(false); }}>Ver detalhe</button></td>
          </tr>)}
        </tbody></table></div>}
      {(page > 0 || result.data.more) && <nav className="profile-actions" aria-label="Páginas de resultados">
        <button className="secondary" disabled={!page} onClick={() => { setPage(page - 1); setSelected(undefined); }}>Anterior</button>
        <span>Página {page + 1}</span>
        <button className="secondary" disabled={!result.data.more} onClick={() => { setPage(page + 1); setSelected(undefined); }}>Seguinte</button>
      </nav>}
    </section>}
    {selected && <section className="panel admin-record" aria-labelledby="record-title">
      <div className="admin-record-heading"><h2 id="record-title"><RecordName row={selected} tab={tab} /></h2>
        <button className="secondary" onClick={() => setSelected(undefined)}>Fechar detalhe</button></div>
      {tab === "reports" ? <ReportDetail id={id} grant={grant} revision={revision} edit={setAction} /> : <>
        <p className="biography">{text(selected, "body") || text(selected, "description") || text(selected, "reason")}</p>
        {tab === "audit" && <p>{text(selected, "actor_id")} · {text(selected, "previous")} → {text(selected, "result")}</p>}
        {tab === "communities" && <p>Responsável {text(selected, "owner_id")} · {String(selected.contributors)} autores no total</p>}
        {tab === "users" && <p>{text(selected, "slug")} · {roles[text(selected, "role")] || "Sem função administrativa"}</p>}
        {tab === "attachments" && selected.has_image === true &&
          <img className="admin-attachment" src={`/api/v1/admin/attachment/${id}`} alt="Anexo da publicação" />}
        {tab === "attachments" && text(selected, "article_url") &&
          <a href={text(selected, "article_url")} target="_blank" rel="noreferrer">Abrir ligação do anexo</a>}
        {grant.role !== "viewer" && <div className="profile-actions">
          {(["posts", "comments", "attachments"].includes(tab) || (tab === "communities" && grant.role === "admin")) &&
            <button className="secondary" onClick={() => {
              const hidden = Boolean(selected[tab === "attachments" ? "attachment_hidden" : "moderation_hidden"]);
              moderate(tab === "attachments" ? "attachment" : tab === "communities" ? "community" : "post",
                       !hidden, hidden ? "Restaurar conteúdo" : "Ocultar conteúdo");
            }}>{selected[tab === "attachments" ? "attachment_hidden" : "moderation_hidden"] ? "Restaurar" : "Ocultar"}</button>}
          {tab === "communities" && <Link href={`/comunidades/${id}`}>Abrir comunidade</Link>}
          {tab === "users" && <>
            <button className="secondary" onClick={() => moderate("account", !selected.suspended,
              selected.suspended ? "Reactivar conta suspensa" : "Suspender conta")}>{selected.suspended ? "Reactivar conta" : "Suspender conta"}</button>
            <button className="secondary" onClick={() => moderate("profile", !selected.moderation_hidden,
              selected.moderation_hidden ? "Restaurar perfil" : "Ocultar perfil")}>{selected.moderation_hidden ? "Restaurar perfil" : "Ocultar perfil"}</button>
            <button className="secondary" onClick={() => setAction({
              title: "Alterar função administrativa", endpoint: `/admin/roles/${id}`,
              fields: <>
                <label>Função<select name="role" defaultValue={text(selected, "role")}><option value="">Sem função</option><Options values={roles} /></select></label>
                <label>Comunidade (apenas para moderadores)<select name="community_id" defaultValue={text(selected, "community_id")}>
                  <option value="">Sem comunidade</option>
                  {communities.map(row => <option value={text(row, "id")} key={text(row, "id")}>{text(row, "name")}</option>)}
                </select></label>
              </>,
              data: fields => ({ role: fields.get("role") || null, community_id: fields.get("community_id") || null }),
            })}>Alterar função</button>
          </>}
        </div>}
        {history?.data && <>
          <h3>Histórico administrativo</h3>
          {history.data.items.length ? <ul>{history.data.items.map(entry => <li key={text(entry, "id")}>
            {showDate(text(entry, "created_at"))} · {text(entry, "action")} · {text(entry, "reason")}
          </li>)}</ul> : <p className="muted">Ainda não há decisões registadas.</p>}
        </>}
      </>}
    </section>}
    {action && <Decision action={action} close={() => setAction(undefined)} completed={refresh} />}
  </>;
}

export default function AdminScreen() {
  const [tab, setTab] = useState<Tab>("metrics");
  const [queueState, setQueueState] = useState("");
  const access = useRequest<Access>("/admin/access");
  const grant = access?.data;
  const communities = useRequest<Row[]>(grant ? "/admin/communities" : "");
  if (!grant) return <main className="site-width profile-shell">
    <h1>Administração SSciX</h1>
    <Feedback error={access?.error} loading={!access} />
    {access?.status === 401 && <Link className="primary" href="/entrar">Entrar</Link>}
    {access?.status === 403 && <Link href="/rede">Voltar à rede</Link>}
  </main>;
  return <main className="site-width admin-shell">
    <aside className="panel admin-rail">
      <p><strong>Administração SSciX</strong><br /><small>{roles[grant.role]}</small></p>
      <nav aria-label="Secções da administração">
        {Object.entries(tabs).filter(([key]) => grant.role !== "moderator" || key !== "users").map(([key, label]) =>
          <button type="button" key={key} aria-current={tab === key ? "page" : undefined} onClick={() => {
            setQueueState(""); setTab(key as Tab);
          }}>{label}</button>)}
      </nav>
      <Link href="/rede">Voltar à rede</Link>
      {grant.role === "admin" && <Link href="/admin/comercial">Gestão comercial</Link>}
      {grant.role === "admin" && <Link href="/admin/blogue">Gestão dos blogues</Link>}
      {process.env.NEXT_PUBLIC_EDITORIAL_ADMIN_URL && grant.role === "admin" &&
        <a href={process.env.NEXT_PUBLIC_EDITORIAL_ADMIN_URL}>Painel editorial</a>}
    </aside>
    <div className="admin-main">
      <Feedback error={communities?.error} loading={false} />
      {tab === "metrics" ? <MetricsPanel grant={grant} communities={communities?.data ?? []}
        openReports={filters => { setQueueState(filters); setTab("reports"); }} /> :
        <Manage key={tab + queueState} tab={tab} grant={grant} communities={communities?.data ?? []} initialFilters={queueState} />}
    </div>
  </main>;
}
