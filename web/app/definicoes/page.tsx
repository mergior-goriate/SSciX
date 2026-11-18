"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, message } from "../api-client";

const settings = [
  ["Email", "/auth/email", "POST", "Enviar confirmação"],
  ["Palavra-passe", "/auth/password", "PUT", "Guardar palavra-passe"],
  ["Desactivar conta", "/auth/deactivate", "POST", "Desactivar conta"],
  ["Eliminar conta", "/auth/account", "DELETE", "Eliminar definitivamente"],
] as const;

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ path: string; text: string; error?: boolean }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("email") === "confirmado") {
      setFeedback({ path: "/auth/email", text: "Novo email confirmado." });
    }
    api<{ email: string }>("/profiles/me").then((profile) => setEmail(profile.email)).catch((failure) => setError(message(failure)));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>, path: string, method: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const { confirmation, ...data } = Object.fromEntries(new FormData(form));
    if (method === "DELETE" && confirmation !== "ELIMINAR") return;
    setBusy(true);
    setFeedback(undefined);
    try {
      const result = await api<{ message: string } | undefined>(path, method, data);
      form.reset();
      if (method === "DELETE" || path === "/auth/deactivate") router.replace("/");
      else setFeedback({ path, text: result?.message ?? "Palavra-passe actualizada." });
    } catch (failure) {
      setFeedback({ path, text: message(failure), error: true });
    } finally {
      setBusy(false);
    }
  }

  return <main className="site-width profile-shell">
    <h1>Definições</h1>
    {error ? <p role="alert">{error} <Link href="/entrar">Entrar</Link></p> : !email ?
      <p role="status">A carregar…</p> : <div className="network-stack">{settings.map(([title, path, method, button]) =>
      <details className="panel settings-panel" key={path} open={feedback?.path === path || undefined}>
        <summary>{title}</summary>
        <form className="form-stack" onSubmit={(event) => void submit(event, path, method)}>
          {path === "/auth/email" && <><p>Email actual: {email}</p>
            <label>Novo email<input name="email" type="email" maxLength={254} autoComplete="email" required /></label></>}
          {path === "/auth/deactivate" && <p>O perfil e as publicações ficam ocultos. Volte a iniciar sessão para reactivar a conta.</p>}
          {method === "DELETE" && <p>A eliminação é definitiva e remove a conta, o perfil e o conteúdo associado.</p>}
          <label>{method === "DELETE" ? "Confirme a palavra-passe" : "Palavra-passe actual"}
            <input name="password" type="password" maxLength={128} autoComplete="current-password" required />
          </label>
          {method === "PUT" && <label>Nova palavra-passe
            <input name="new_password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
          </label>}
          {method === "DELETE" && <label>Escreva ELIMINAR para confirmar<input name="confirmation" pattern="ELIMINAR" required /></label>}
          <button className={method === "DELETE" ? "danger" : "primary"} disabled={busy}>{button}</button>
          {feedback?.path === path && <p className={feedback.error ? "notice error" : "notice"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
        </form>
      </details>)}</div>}
  </main>;
}
