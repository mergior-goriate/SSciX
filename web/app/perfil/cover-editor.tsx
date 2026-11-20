"use client";

import { Camera } from "lucide-react";
import { useState } from "react";
import { api, message } from "../api-client";
import { readImage } from "../media";

export default function CoverEditor({ initial }: { initial: boolean }) {
  const [hasCover, setHasCover] = useState(initial);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean }>();

  async function save(file: File | null) {
    setBusy(true);
    setStatus(undefined);
    try {
      const image = file ? await readImage(file, 500 * 1024) : "";
      await api("/profiles/me/cover", "PUT", { image });
      setHasCover(Boolean(file));
      setRevision((value) => value + 1);
      setStatus({ text: file ? "Imagem de capa guardada." : "Imagem de capa removida." });
    } catch (failure) {
      setStatus({ text: message(failure), error: true });
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="own-profile-cover" aria-busy={busy}>
      {hasCover && <img className="profile-cover-image" src={`/api/v1/profiles/me/cover?v=${revision}`} alt="" />}
      <div className="profile-cover-controls">
        <label className="secondary own-photo-upload icon-action">
          <Camera size={17} aria-hidden="true" /> {hasCover ? "Alterar capa" : "Adicionar capa"}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void save(file);
            }} />
        </label>
        {hasCover && <button className="secondary" type="button" disabled={busy} onClick={() => void save(null)}>
          Remover capa
        </button>}
      </div>
    </div>
    {status && <p className={`notice cover-notice${status.error ? " error" : ""}`} role={status.error ? "alert" : "status"}>
      {status.text}
    </p>}
  </>;
}
