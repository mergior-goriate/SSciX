import Link from "next/link";

export default function Home() {
  return (
    <main className="site-width landing">
      <div className="hero">
        <div className="hero-copy">
          <a className="parent-brand" href="https://www.sussurrosdosaber.com/">Sussurros do Saber</a>
          <h1>Ciência que conecta pessoas e transforma conhecimento.</h1>
          <p>Apresente a sua trajectória académica, encontre investigadores e participe em debates de investigação.</p>
          <div className="hero-actions">
            <Link href="/registar" className="primary">Criar conta <span aria-hidden="true">→</span></Link>
            <Link href="/entrar" className="secondary">Entrar</Link>
            <Link href="/rede" className="secondary">Explorar a rede</Link>
          </div>
        </div>
        <div className="atlas" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
          <div className="orbit-core" /><i className="star star-one" /><i className="star star-two" /><i className="star star-three" />
        </div>
      </div>
    </main>
  );
}
