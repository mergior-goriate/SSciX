import Link from "next/link";

export const metadata = { title: "Política de Publicação e Monetização" };

export default function Policy() {
  return <main className="site-width information-shell">
    <article className="panel form-stack">
      <h1>Política de Publicação e Monetização dos Blogues</h1>
      <h2>Autoria e visibilidade</h2>
      <p>A equipa editorial publica no blogue oficial. Nos blogues individuais, cada autor escolhe se o seu texto é público ou reservado a membros da SSciX. Os rascunhos ficam na área de edição até serem publicados.</p>
      <h2>Fontes, direitos de autor e interesses</h2>
      <p>Indica as fontes das afirmações que sustentes com estudos. Sempre que possível, inclui o DOI ou uma ligação para a publicação original. Respeita as licenças de imagens, tabelas e demais materiais de terceiros. Identifica os patrocínios e as ligações de afiliado junto do conteúdo em causa.</p>
      <h2>Correcções e actualizações</h2>
      <p>Ao alterar um texto publicado, indica o que mudou. A nota fica datada no artigo. A mesma regra aplica-se ao blogue oficial.</p>
      <h2>Denúncias e moderação</h2>
      <p>Usa a opção «Denunciar» para assinalar plágio, exposição indevida de dados pessoais ou outros problemas. A equipa avalia a denúncia e pode restringir a visibilidade do artigo. O autor pode consultar o motivo na área de edição e contactar a equipa pelo <Link href="/ajuda">Centro de ajuda</Link>.</p>
      <h2>Anúncios por artigo</h2>
      <p>A publicidade começa desligada. Depois de rever um artigo público, a equipa pode activar um anúncio do Google AdSense no fim da página. Se o conteúdo mudar, a publicidade fica suspensa até uma nova revisão. A equipa também pode desactivá-la a qualquer momento.</p>
      <h2>Destino das receitas</h2>
      <p>Nesta fase, a receita publicitária destina-se ao funcionamento e ao desenvolvimento da SSciX. Se for criado um programa de partilha com os autores, a SSciX publicará os critérios, o cálculo e os prazos antes do lançamento.</p>
      <h2>Políticas relacionadas</h2>
      <p>Consulta também os <Link href="/termos">Termos de Utilização</Link>, as <Link href="/ajuda#comunidades">Regras das Comunidades</Link> e a secção de <Link href="/termos#privacidade">Privacidade</Link>.</p>
    </article>
  </main>;
}
