import Link from "next/link";

export const metadata = { title: "Centro de ajuda" };

export default function Page() {
  return <main className="site-width profile-shell">
    <section className="panel form-stack">
      <h1>Centro de ajuda</h1>
      <details><summary>Como começo a publicar?</summary><p>Abra <Link href="/perfil">o seu perfil</Link>, active a visibilidade pública e escolha «Criar publicação» no <Link href="/rede">feed</Link>.</p></details>
      <details><summary>Como encontro investigadores?</summary><p>Abra a <Link href="/pessoas">pesquisa</Link> e procure pelo nome, pela instituição ou pela área.</p></details>
      <details><summary>Como recupero o acesso à conta?</summary><p><Link href="/recuperar">Peça um novo link de recuperação</Link> ou <Link href="/reenviar-confirmacao">reenvie a confirmação do email</Link>.</p></details>
      <details><summary>Quem pode ver as minhas mensagens?</summary><p>Apenas os dois participantes podem consultar a conversa.</p></details>
    </section>
  </main>;
}
