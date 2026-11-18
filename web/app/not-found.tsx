import Link from "next/link";

export default function NotFound() {
  return (
    <main className="site-width auth-shell">
      <div className="auth-content">
        <h1>Página indisponível</h1>
        <p className="muted">Confira o endereço ou regresse à página inicial.</p>
        <Link href="/" className="secondary">Página inicial</Link>
      </div>
    </main>
  );
}
