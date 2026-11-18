"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, message } from "../../api-client";

type Counts = { followers: number; following_count: number };
type FollowStatus = Counts & { following: boolean; can_follow: boolean };

export default function FollowButton({ slug, showCounts = false }: { slug: string; showCounts?: boolean }) {
  const path = `/profiles/${slug}/follow`;
  const [status, setStatus] = useState<FollowStatus>();
  const [counts, setCounts] = useState<Counts>();
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<FollowStatus>(path).then((result) => {
      if (active) setStatus(result);
    }).catch((failure) => {
      if (!active) return;
      if (failure?.status === 401) {
        setGuest(true);
        if (showCounts) api<Counts>(`/profiles/${slug}/counts`).then((result) => {
          if (active) setCounts(result);
        }).catch(() => {});
      }
      else setError(message(failure));
    });
    return () => { active = false; };
  }, [path, showCounts, slug]);

  async function toggle() {
    if (!status || busy) return;
    setBusy(true);
    setError("");
    try {
      setStatus(await api<FollowStatus>(path, status.following ? "DELETE" : "PUT"));
    } catch (failure) {
      if (typeof failure === "object" && failure && "status" in failure && failure.status === 401) {
        setGuest(true);
      } else {
        setError(message(failure));
      }
    } finally {
      setBusy(false);
    }
  }

  const totals = status ?? counts;
  return (
    <div>
      {showCounts && totals && <p className="follow-counts" aria-live="polite">
        <span>{totals.followers} Seguidores</span><span>{totals.following_count} A seguir</span>
      </p>}
      {guest && <Link className="secondary" href="/entrar">Entrar para seguir</Link>}
      {!guest && status?.can_follow && (
        <button className="secondary" type="button" onClick={toggle} disabled={busy}>
          {status.following ? "Deixar de seguir" : "Seguir"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
