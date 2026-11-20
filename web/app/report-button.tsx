"use client";

import { useRef, useState, type FormEvent } from "react";
import { api, message } from "./api-client";

export default function ReportButton({ kind, id, label = "Denunciar" }: {
  kind: "post" | "community" | "profile" | "message" | "attachment"; id: string; label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const reason = new FormData(event.currentTarget).get("reason");
    try {
      if (kind === "profile") await api(`/reports/profile/${encodeURIComponent(id)}`, "POST", { reason });
      else await api("/reports", "POST", { target_type: kind, target_id: id, reason });
      setSent(true);
      setStatus("Denúncia enviada para análise.");
    } catch (failure) {
      setStatus(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <div className="report-control">
    <button className="secondary" type="button" onClick={() => dialog.current?.showModal()}>{label}</button>
    <dialog className="panel report-dialog" ref={dialog} aria-label={label}>
      <form className="form-stack" onSubmit={submit}>
        <h2>{label}</h2>
        {!sent && <label>Motivo<textarea name="reason" minLength={3} maxLength={1200} rows={4} required /></label>}
        {status && <p role={sent ? "status" : "alert"}>{status}</p>}
        <div className="profile-actions">
          {!sent && <button className="primary" disabled={busy}>Enviar denúncia</button>}
          <button className="secondary" type="button" onClick={() => dialog.current?.close()}>Fechar</button>
        </div>
      </form>
    </dialog>
  </div>;
}
