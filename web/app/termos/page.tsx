import { CircleHelp, FileText, Settings, Shield } from "lucide-react";
import Link from "next/link";
import InformationLayout, { InformationSection } from "../information-layout";

export const metadata = { title: "Termos de utilização" };

const sections = [
  { href: "#privacidade", label: "Privacidade", icon: Shield },
  { href: "#conta", label: "Gestão da conta", icon: Settings },
  { href: "/ajuda", label: "Centro de ajuda", icon: CircleHelp },
];

export default function Terms() {
  return <InformationLayout title="Termos de utilização" description="Versão local-v1 · Ambiente de desenvolvimento" icon={FileText} links={sections}>
    <InformationSection id="privacidade" title="Privacidade" icon={Shield}>
      <p>A SSciX guarda o email, as credenciais de acesso e os dados introduzidos no perfil. O email da conta permanece privado.</p>
      <p>Ao activar a visibilidade pública, autoriza a apresentação dos campos do perfil a membros da SSciX com sessão iniciada.</p>
      <p>Introduza apenas informações que pode partilhar. A afiliação, a função académica e o ORCID são declarados pelo titular.</p>
    </InformationSection>
    <InformationSection id="conta" title="Gestão da conta" icon={Settings}>
      <p>Pode tornar o perfil privado em <Link href="/perfil">Meu perfil</Link> ou eliminar a conta em <Link href="/definicoes">Definições</Link>, na categoria Gestão da conta.</p>
    </InformationSection>
  </InformationLayout>;
}
