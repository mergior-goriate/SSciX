export const views = {
  entrar: { title: "Entrar na SSciX", copy: "Aceda ao seu perfil académico.", button: "Entrar", endpoint: "login" },
  registar: { title: "Criar uma conta", copy: "Comece pelo seu perfil académico.", button: "Criar conta", endpoint: "register" },
  "confirmar-email": { title: "Confirmar email", copy: "Confirme o endereço associado à sua conta.", button: "Confirmar email", endpoint: "verify" },
  "reenviar-confirmacao": { title: "Reenviar confirmação", copy: "Peça um novo link para confirmar o seu email.", button: "Enviar link", endpoint: "resend" },
  "confirmar-novo-email": { title: "Confirmar novo email", copy: "Confirme a alteração do endereço associado à conta.", button: "Confirmar novo email", endpoint: "confirm-email-change" },
  recuperar: { title: "Recuperar palavra-passe", copy: "Receba um link para criar uma nova palavra-passe.", button: "Enviar link", endpoint: "forgot-password" },
  "nova-palavra-passe": { title: "Nova palavra-passe", copy: "Escolha uma nova palavra-passe para a sua conta.", button: "Guardar palavra-passe", endpoint: "reset-password" },
} as const;

export type View = keyof typeof views;

