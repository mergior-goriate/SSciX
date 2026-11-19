"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { api, message } from "./api-client";

import { views, type View } from "./auth-views";

export default function AuthForm({ view }: { view: View }) {
  const linkRead = useRef(false);
  const [secret, setSecret] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);
  const needsToken = view === "confirmar-email" || view === "confirmar-novo-email" || view === "nova-palavra-passe";
  const registration = view === "registar";
  const login = view === "entrar";
  const currentPassword = login || view === "confirmar-email" || view === "confirmar-novo-email";
  const asksPassword = registration || login || needsToken;
  const spec = views[view];

  useEffect(() => {
    if (needsToken && !linkRead.current) {
      linkRead.current = true;
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      setSecret(value);
      if (value) history.replaceState(history.state, "", window.location.pathname);
      else setFeedback({ text: "Abra o link completo recebido por email ou peça um novo link.", error: true });
    }
  }, [needsToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || done) return;
    setBusy(true);
    setFeedback(undefined);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (needsToken) values.token = secret;
    const data = registration ? { ...values, accept_terms: values.accept_terms === "on" } : values;
    try {
      const result = await api<{ message: string } | undefined>("/auth/" + spec.endpoint, "POST", data);
      if (login) {
        window.location.replace("/perfil");
        return;
      }
      if (view === "confirmar-email" || view === "confirmar-novo-email") {
        window.location.replace(view === "confirmar-email" ? "/onboarding" : "/definicoes?email=confirmado");
        return;
      }
      const success = "Palavra-passe atualizada. Entre com os novos dados.";
      setFeedback({ text: result?.message ?? success, error: false });
      setDone(true);
    } catch (error) {
      setFeedback({ text: message(error), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-content">
      <h1>{spec.title}</h1>
      <p className="muted">{spec.copy}</p>
      {!done && <form className="form-stack" onSubmit={submit}>
        {registration && <>
          <label>Nome completo<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
          <label>Endereço público<input name="slug" autoComplete="username" placeholder="ex. ana-mateus" required minLength={3} maxLength={40} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
        </>}
        {!needsToken && <label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="nome@instituicao.edu" /></label>}
        {registration && <div className="registration-password">
          <label htmlFor="registration-password">Palavra-passe</label>
          <div className="registration-password-field">
            <input id="registration-password" name="password" type={showRegistrationPassword ? "text" : "password"}
              autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="registration-password-hint" />
            <button type="button" aria-label={showRegistrationPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
              onClick={() => setShowRegistrationPassword((visible) => !visible)}>
              {showRegistrationPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
          <small id="registration-password-hint">Mínimo de 12 caracteres.</small>
        </div>}
        {asksPassword && !registration && <label>Palavra-passe
          <input type="password" name="password" autoComplete={currentPassword ? "current-password" : "new-password"}
            required minLength={currentPassword ? 1 : 12} maxLength={128} />
          {!currentPassword && <small>Mínimo de 12 caracteres.</small>}
        </label>}
        {registration && <label className="check"><input type="checkbox" name="accept_terms" required />
          <span>Li e aceito os <Link href="/termos" target="_blank" rel="noopener">termos de utilização</Link>.</span>
        </label>}
        <button className="primary" disabled={busy || (needsToken && !secret)}>{busy ? "A processar…" : spec.button}<span aria-hidden="true"> →</span></button>
      </form>}
      {feedback && <p className={feedback.error ? "notice error" : "notice"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      <div className="auth-links">
        {login ? <Link href="/recuperar">Esqueci a palavra-passe</Link>
          : <Link href="/entrar">Voltar à entrada</Link>}
        {(login || registration || view === "confirmar-email") && <Link href="/reenviar-confirmacao">Reenviar confirmação</Link>}
        {login && <Link href="/registar" className="secondary sign-in-register">Criar conta</Link>}
        {view === "nova-palavra-passe" && <Link href="/recuperar">Pedir novo link</Link>}
      </div>
    </div>
  );
}
