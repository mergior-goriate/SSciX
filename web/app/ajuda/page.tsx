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
    <div className="network-stack">
      <section className="panel" id="comunidades">
        <h2>Políticas das comunidades</h2>
        <p>Mantenha os debates no tema da comunidade e discuta as ideias com respeito. Identifique as fontes quando citar trabalhos de outras pessoas e partilhe apenas materiais cuja divulgação é permitida.</p>
      </section>
      <section className="panel" id="acessibilidade">
        <h2>Acessibilidade</h2>
        <p>Use Tab para percorrer ligações e controlos. Os ícones do cabeçalho têm nomes para leitores de ecrã. Pode fechar o painel de notificações com Esc.</p>
      </section>
      <section className="panel" id="recomendacoes">
        <h2>Visibilidade das recomendações</h2>
        <p>Os membros com sessão iniciada podem receber sugestões de perfis visíveis na rede. A SSciX dá prioridade a temas em comum e pode sugerir outros perfis quando faltam correspondências. O seu próprio perfil e os perfis que já segue ficam de fora das suas sugestões.</p>
        <p>Para retirar o seu perfil das sugestões de outros membros, ajuste a visibilidade em <Link href="/perfil">Meu perfil</Link>.</p>
      </section>
    </div>
  </main>;
}
