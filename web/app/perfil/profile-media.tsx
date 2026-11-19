"use client";

import { Camera, Plus, Trash2 } from "lucide-react";
import type { SocialLink } from "../profile-data";
import Avatar from "../avatar";

const platforms = ["Facebook", "Instagram", "X", "LinkedIn", "Outra"] as const;

export function PhotoEditor({ name, photo, change }: {
  name: string; photo: string; change: (file: File | null) => void;
}) {
  return <div className="profile-photo-editor">
    <Avatar name={name} photo={photo} className="initials" />
    <div>
      <label className="secondary photo-label own-photo-upload"><span><Camera size={18} aria-hidden="true" /> {photo ? "Alterar fotografia" : "Adicionar fotografia"}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) change(file);
          event.target.value = "";
        }} />
      </label>
      {photo && <button type="button" className="secondary" onClick={() => change(null)}>Remover fotografia</button>}
    </div>
  </div>;
}

export function SocialEditor({ links, change }: { links: SocialLink[]; change: (links: SocialLink[]) => void }) {
  function update(index: number, next: Partial<SocialLink>) {
    change(links.map((link, position) => position === index ? { ...link, ...next } : link));
  }

  return <fieldset className="form-stack social-editor">
    <legend>Redes sociais</legend>
    {links.map((link, index) => <div key={index} className="social-row">
      <label>Rede<select value={link.platform} onChange={(event) => update(index, { platform: event.target.value as SocialLink["platform"] })}>
        {platforms.map((platform) => <option key={platform}>{platform}</option>)}
      </select></label>
      <label>Endereço<input type="url" value={link.url} maxLength={500} required
        onChange={(event) => update(index, { url: event.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={link.public}
        onChange={(event) => update(index, { public: event.target.checked })} /> Mostrar no perfil</label>
      <button type="button" className="secondary icon-action" aria-label={`Remover ligação ${index + 1}`}
        onClick={() => change(links.filter((_, position) => position !== index))}><Trash2 size={17} aria-hidden="true" /></button>
    </div>)}
    <button type="button" className="secondary icon-action" disabled={links.length >= 8}
      onClick={() => change([...links, { platform: "Outra", url: "", public: true }])}><Plus size={17} aria-hidden="true" /> Adicionar ligação</button>
  </fieldset>;
}
