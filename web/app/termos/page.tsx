export const metadata = { title: "Termos de utilização" };

export default function Terms() {
  return (
    <main className="site-width auth-shell">
      <article className="auth-content">
        <h1>Termos de utilização</h1>
        <p className="muted">Versão local-v1 · Ambiente de desenvolvimento</p>
        <h2 id="privacidade">Privacidade</h2>
        <p>A SSciX guarda o email, as credenciais de acesso e os dados introduzidos no perfil. O email da conta permanece privado.</p>
        <p>Ao ativar a visibilidade pública, autoriza a apresentação dos campos do perfil a membros da SSciX com sessão iniciada.</p>
        <p>Introduza apenas informações que pode partilhar. A afiliação, a função académica e o ORCID são declarados pelo titular.</p>
        <p>Pode tornar o perfil privado em Meu perfil ou eliminar a conta em Definições, na categoria Gestão da conta.</p>
      </article>
    </main>
  );
}
