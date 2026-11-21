import Link from "next/link";
import Script from "next/script";

export const dynamic = "force-dynamic";

export const metadata = { title: "Organizar uma revisão de literatura" };

export default function Guide() {
  const publisher = process.env.SSCIX_ADSENSE_PUBLISHER ?? "";
  const slot = process.env.SSCIX_ADSENSE_GUIDE_SLOT ?? "";
  const adsEnabled = process.env.SSCIX_ADSENSE_ENABLED === "1" && /^ca-pub-\d{16}$/.test(publisher) && /^\d{1,16}$/.test(slot);

  return <main className="site-width information-shell">
    <article className="panel form-stack">
      <h1>Organizar uma revisão de literatura</h1>
      <p>Comece por delimitar a pergunta. Por exemplo, «Quais são os efeitos da salinidade do solo no rendimento do milho?» permite identificar a cultura, a exposição e o resultado que pretende estudar.</p>
      <h2>Registar o percurso da pesquisa</h2>
      <p>Guarde as bases que consultou, a data de cada consulta e as expressões utilizadas. Inclua sinónimos em português e noutras línguas relevantes para que outra pessoa possa repetir a pesquisa.</p>
      <h2>Documentar a selecção</h2>
      <p>Defina os critérios de inclusão antes de seleccionar os estudos. Registe os motivos para excluir textos lidos na íntegra e anote como cada estudo mediu os resultados. Esta informação ajuda a explicar diferenças entre estudos semelhantes.</p>
      <h2>Conferir as referências</h2>
      <p>Abra a fonte original e confirme a autoria, o ano e o DOI. Quando citar um resultado, verifique a página, a tabela ou a figura onde aparece. Registe também qual versão consultou se houver um manuscrito preliminar e um artigo publicado.</p>
      <Link href="/guias/parceria">Recursos de formação de parceiros</Link>
    </article>
    {adsEnabled && <aside className="panel" aria-label="Publicidade">
      <p className="muted">Publicidade</p>
      <ins className="adsbygoogle" style={{ display: "block", minHeight: 120 }}
        data-ad-client={publisher} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
      <Script id="sscix-adsense-library" async crossOrigin="anonymous" strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`} />
      <Script id="sscix-adsense-guide" strategy="afterInteractive">{`(window.adsbygoogle = window.adsbygoogle || []).push({});`}</Script>
    </aside>}
  </main>;
}
