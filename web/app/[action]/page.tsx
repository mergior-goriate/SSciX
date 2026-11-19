import { notFound } from "next/navigation";
import AcademicAtlas from "../academic-atlas";
import AuthForm from "../auth-form";
import { views, type View } from "../auth-views";

export async function generateMetadata({ params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return { title: Object.hasOwn(views, action) ? views[action as View].title : "Página indisponível",
    robots: { index: false, follow: false } };
}

export default async function AccountAction({ params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!Object.hasOwn(views, action)) notFound();
  if (action === "entrar" || action === "registar") {
    const registration = action === "registar";
    return <main className={`account-split${registration ? " registration-split" : ""}`}>
      <section className="account-brand" aria-label="Sobre a SSciX">
        <span className="wordmark">
          <span className="mark" aria-hidden="true"><i /><i /><i /></span>
          <span>SSci<span className="accent">X</span></span>
        </span>
        <div className="account-intro">
          <p>Rede académica do Sussurros do Saber</p>
          <h2>{registration ? "Partilhe o seu trabalho com a comunidade académica." : "A investigação começa com uma conversa."}</h2>
          {!registration && <p>Encontre investigadores, partilhe o seu trabalho e participe em debates académicos.</p>}
        </div>
        <AcademicAtlas />
      </section>
      <div className="account-form">
        <AuthForm key={action} view={action} />
      </div>
    </main>;
  }
  return <main className="site-width auth-shell"><AuthForm key={action} view={action as View} /></main>;
}
