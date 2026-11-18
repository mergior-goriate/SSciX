"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, message } from "../../api-client";

type FollowStatus = { following: boolean; can_follow: boolean };

export default function FollowButton({ slug }: { slug: string }) {
  const path = `/profiles/${slug}/follow`;
  const [status, setStatus] = useState<FollowStatus>();
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<FollowStatus>(path).then((result) => {
      if (active) setStatus(result);
    }).catch((failure) => {
      if (!active) return;
      if (failure?.status === 401) setGuest(true);
      else setError(message(failure));
    });
    return () => { active = false; };
  }, [path]);

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

  if (guest) return <Link className="secondary" href="/entrar">Entrar para seguir</Link>;
  return (
    <div>
      {status?.can_follow && (
        <button className="secondary" type="button" onClick={toggle} disabled={busy}>
          {status.following ? "Deixar de seguir" : "Seguir"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
