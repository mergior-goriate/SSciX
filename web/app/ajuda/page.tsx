import { Accessibility, BookOpen, ChevronDown, CircleHelp, FileText, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import InformationLayout, { InformationSection } from "../information-layout";

export const metadata = { title: "Centro de ajuda" };

const sections = [
  { href: "#perguntas", label: "Perguntas frequentes", icon: CircleHelp },
  { href: "#comunidades", label: "Políticas das comunidades", icon: Users },
  { href: "#acessibilidade", label: "Acessibilidade", icon: Accessibility },
  { href: "#recomendacoes", label: "Visibilidade das recomendações", icon: Sparkles },
  { href: "/termos", label: "Termos de utilização", icon: FileText },
];

const questions = [
  ["Como começo a publicar?", <>Abra <Link href="/perfil">o seu perfil</Link>, active a visibilidade pública e escolha «Criar publicação» no <Link href="/rede">feed</Link>.</>],
  ["Como encontro investigadores?", <>Abra a <Link href="/pessoas">pesquisa</Link> e procure pelo nome, pela instituição ou pela área.</>],
  ["Como recupero o acesso à conta?", <><Link href="/recuperar">Peça um novo link de recuperação</Link> ou <Link href="/reenviar-confirmacao">reenvie a confirmação do email</Link>.</>],
  ["Quem pode ver as minhas mensagens?", "Apenas os dois participantes podem consultar a conversa."],
] as const;

export default function Page() {
  return <InformationLayout title="Centro de ajuda" description="Encontre respostas sobre a sua conta e a participação na rede." icon={BookOpen} links={sections}>
    <InformationSection id="perguntas" title="Perguntas frequentes" icon={CircleHelp}>
      <div className="information-faq">{questions.map(([question, answer]) =>
        <details key={question}>
          <summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary>
          <p>{answer}</p>
        </details>)}</div>
    </InformationSection>
    <InformationSection id="comunidades" title="Políticas das comunidades" icon={Users}>
      <p>Mantenha os debates no tema da comunidade e discuta as ideias com respeito. Identifique as fontes quando citar trabalhos de outras pessoas e partilhe apenas materiais cuja divulgação é permitida.</p>
    </InformationSection>
    <InformationSection id="acessibilidade" title="Acessibilidade" icon={Accessibility}>
      <p>Use <kbd>Tab</kbd> para percorrer ligações e controlos. Os ícones do cabeçalho têm nomes para leitores de ecrã. Pode fechar o painel de notificações com <kbd>Esc</kbd>.</p>
    </InformationSection>
    <InformationSection id="recomendacoes" title="Visibilidade das recomendações" icon={Sparkles}>
      <p>Os membros com sessão iniciada podem receber sugestões de perfis visíveis na rede. A SSciX dá prioridade a temas em comum e pode sugerir outros perfis quando faltam correspondências. O seu próprio perfil e os perfis que já segue ficam de fora das suas sugestões.</p>
      <p>Para retirar o seu perfil das sugestões de outros membros, ajuste a visibilidade em <Link href="/perfil">Meu perfil</Link>.</p>
    </InformationSection>
  </InformationLayout>;
}
