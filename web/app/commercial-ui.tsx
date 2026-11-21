"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, message } from "./api-client";
import { useNetworkData } from "./use-network-data";

const states = { pending: "Por contactar", contacted: "Contactado", closed: "Encerrado" } as const;
type Enquiry = { id: string; institution: string; use_case: string; status: keyof typeof states; email?: string };
type Commercial = { requests: Enquiry[]; more: boolean; affiliates: { campaign: string; status: string; count: number }[] };

export function PartnerOffer() {
  const { data, error } = useNetworkData<{ available: boolean }>("/commercial/affiliate");
  if (error) return <p role="alert">Não foi possível consultar a oferta.</p>;
  if (!data) return <p role="status">A consultar a oferta…</p>;
  if (!data.available) return <p>De momento, não há ofertas de parceiros.</p>;
  return <>
    <p>A SSciX pode receber uma comissão se efectuar uma inscrição através desta ligação.</p>
    <a className="secondary" rel="sponsored noreferrer" href="/api/v1/commercial/click/formacao-academica">Consultar a oferta de formação do parceiro</a>
  </>;
}

export function InstitutionalEnquiry() {
  const { data, error, refresh } = useNetworkData<Enquiry[]>("/institutional");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setStatus("");
    try {
      await api("/institutional", "POST", Object.fromEntries(new FormData(form)));
      form.reset();
      refresh();
      setStatus("Pedido registado.");
    } catch (failure) {
      setStatus(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form className="form-stack" onSubmit={submit}>
      <label>Instituição<input name="institution" maxLength={160} required /></label>
      <label>Como pretende usar a SSciX?<textarea name="use_case" maxLength={600} required /></label>
      <button className="primary" disabled={busy}>Pedir contacto</button>
    </form>
    {(status || error) && <p role="status">{status || error}</p>}
    {data && data.length > 0 && <ul>{data.map((item) => <li key={item.id}>{item.institution} · {states[item.status]}</li>)}</ul>}
  </>;
}

export function CommercialAdmin() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error, refresh } = useNetworkData<Commercial>(`/admin/commercial?offset=${page * 25}`);
  const affiliateStates: Record<string, string> = { pending: "Cliques sem inscrição confirmada", confirmed: "Inscrições confirmadas", refunded: "Inscrições reembolsadas" };

  async function change(path: string, values: object, confirmation: string) {
    setBusy(true);
    setStatus("");
    try {
      await api(path, "PUT", values);
      refresh();
      setStatus(confirmation);
    } catch (failure) {
      setStatus(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel form-stack">
    <Link href="/admin">Voltar à administração</Link>
    {(status || error) && <p role="status">{status || error}</p>}
    {data && <>
      <h2>Pedidos institucionais</h2>
      {data.requests.length === 0 && <p>Sem pedidos nesta página.</p>}
      {data.requests.map((item) => <div key={item.id}>
        <h3>{item.institution}</h3><p>{item.use_case}</p>
        <a href={`mailto:${item.email}`}>{item.email}</a>
        <label>Estado<select value={item.status} disabled={busy} onChange={(event) =>
          void change(`/admin/commercial/${item.id}`, { status: event.target.value }, "Estado guardado.")}>
          {Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>)}
      <div className="feed-filters">
        <button className="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
        <button className="secondary" disabled={!data.more} onClick={() => setPage(page + 1)}>Seguinte</button>
      </div>
      <h2>Programa de afiliados</h2>
      {data.affiliates.length ? <ul>{data.affiliates.map((item) => <li key={`${item.campaign}/${item.status}`}>
        {item.campaign} · {affiliateStates[item.status]} · {item.count}
      </li>)}</ul> : <p>Sem actividade registada.</p>}
      <h2>Validar afiliação académica</h2>
      <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        void change(`/admin/affiliations/${encodeURIComponent(String(fields.get("id")))}`,
          { confirmed: fields.get("status") === "confirmed", reason: fields.get("reason") }, "Validação guardada.");
      }}>
        <label>Identificador da afiliação<input name="id" pattern="[0-9a-fA-F-]{36}" required /></label>
        <label>Decisão<select name="status"><option value="confirmed">Confirmar com base na resposta da instituição</option>
          <option value="revoked">Retirar validação</option></select></label>
        <label>Referência da confirmação ou motivo<input name="reason" minLength={3} maxLength={300} required /></label>
        <button className="primary" disabled={busy}>Guardar decisão</button>
      </form>
    </>}
  </section>;
}
