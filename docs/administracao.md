# Administração da SSciX

O painel fica em `/admin`. A API usa `/api/v1/admin`. O login é o da SSciX, com a sua sessão existente. O repositório usa autenticação própria por email e palavra-passe, sem fornecedor de identidade partilhado com o Sussurros do Saber. O painel pode mostrar um atalho editorial aos administradores se `NEXT_PUBLIC_EDITORIAL_ADMIN_URL` for configurado na compilação do frontend. O portal editorial continua responsável pelo seu próprio acesso.

## Primeiro acesso

1. Aplique as migrações com `alembic upgrade head`. O arranque normal da API também as aplica.
2. Confirme a existência de uma conta pessoal, já verificada e activa na SSciX. Use a consola de operação do serviço da API, com a ligação PostgreSQL do ambiente correcto e a partir da pasta `api`.
3. Execute `python -m scripts.bootstrap_admin pessoa@exemplo.org`, substituindo o endereço pelo da pessoa que vai administrar a rede. O comando só actua quando não existe outro administrador e regista a operação na auditoria.
4. Inicie sessão normalmente e entre em `/admin` ou escolha **Administração** no menu. Atribua os acessos seguintes em **Utilizadores e perfis**.

**Administrador** tem acesso à rede inteira e gere funções, suspensões e moderação. **Moderador** pode consultar indicadores e tratar denúncias, publicações, comentários e anexos da comunidade atribuída. **Consulta** pode consultar registos e exportar indicadores, sem alterar funções, contas ou conteúdo. A leitura de uma mensagem privada só é possível para um administrador, a partir de uma denúncia aberta pelo destinatário, e deixa registo. Os moderadores são atribuídos a uma comunidade por função. Contas com funções administrativas precisam de perder a função antes de se desactivarem ou eliminarem.

## Módulos e operações

| Módulo actual | Operações e indicadores |
| --- | --- |
| Contas, autenticação, sessões e perfis | Consulta, suspensão com revogação de sessões, reactivação administrativa, ocultação de perfil, funções, registos, logins e sessões criadas. |
| Comunidades | Consulta de responsáveis, ocultação e restauro, moderação por comunidade, publicações e autores distintos acumulados e por período. |
| Feed, comentários, debates, colaborações, clubes de leitura e oportunidades | Consulta, pesquisa, ocultação e restauro. Contagens por data e, quando aplicável, por tipo e comunidade. |
| Imagens e ligações anexadas a publicações | Pré-visualização administrativa, ocultação e restauro, denúncias de anexos. |
| Seguidores, reacções, guardados, menções e inscrições | Contagem dos registos actuais. A ocultação do conteúdo também o retira das superfícies públicas que dependem dele. |
| Mensagens privadas | Contagem agregada por data. A leitura de uma mensagem denunciada exige abertura do caso e fica auditada. |
| Denúncias e auditoria | Denúncias de perfis, comunidades, publicações, comentários, anexos e mensagens recebidas. Fila com estado, prioridade e responsável. Decisões com motivo e histórico, e acções de moderação associadas ao conteúdo. |

## Cálculo dos indicadores

O período inclui o primeiro e o último dia, em hora de Maputo. A comparação usa o mesmo número de dias imediatamente anteriores. O gráfico, a tabela diária e o CSV lêem o mesmo serviço. O CSV inclui totais, período anterior e séries diárias. O momento da exportação fica na auditoria e passa a contar nas consultas posteriores. Um traço no painel ou valor vazio no CSV significa que a fonte não cobre o período, que o filtro não se aplica ou que falta denominador.

- **Entradas** contam inícios bem-sucedidos pelo formulário de login. **Sessões criadas** contam a emissão de uma nova sessão, incluindo a criação no login, na confirmação de conta ou na renovação. Uma sessão que seja simultaneamente um login aparece nos dois indicadores por definição.
- **Visitas autenticadas** contam sessões distintas com uma página registada. **Visualizações** contam cada abertura interna registada pelo navegador, incluindo visitas repetidas. As páginas de detalhe de publicações e comunidades têm contadores próprios. As visualizações únicas contam pares distintos de conta e publicação ou de conta e comunidade. **Visitantes únicos** são contas distintas identificáveis. As sessões são atribuídas por um derivado separado do segredo da sessão. O segredo bruto não é gravado na tabela de eventos.
- **Frequência** usa os dias em que cada conta abriu pelo menos uma página. Mostra a média desses dias por conta activa e a percentagem de contas activas que regressaram noutro dia do período. Os contadores diários, semanais e mensais contam contas distintas em janelas de 1, 7 e 30 dias até ao fim do período.
- **Crescimento e participação** usam a data dos registos que ainda existem. As adesões a comunidades ainda não têm tabela própria. O número de autores distintos mede a participação por publicações e comentários. Reacções, seguimentos, inscrições, guardados e menções são fotografias do estado actual e não têm comparação histórica.
- **Denúncias recebidas e pendentes** usam a data de criação. Pendentes incluem casos em análise. **Encerradas** usam a data de resolução ou arquivamento. A mediana é calculada em horas sobre os casos encerrados no período. Um caso reaberto deixa de contar como encerrado até ser fechado novamente.
- **Dados por comunidade** incluem o conteúdo e as vistas contextuais dessa comunidade. Entradas, sessões criadas, registos globais, seguimentos e mensagens privadas ficam indisponíveis nesse âmbito. O filtro por tipo aplica-se às publicações, aos seus comentários, aos autores e aos subtotais de actividades. Métricas de autenticação, visitas, moderação e mensagens mantêm o âmbito indicado separadamente.

A migração `0008` grava a data de início da recolha. As janelas que atravessam essa data têm cobertura parcial. A recolha conta páginas autenticadas da rede e depende do JavaScript do navegador. A SSciX ainda não mede visitas anónimas, impressões do feed, séries individuais por publicação ou comunidade, adesões formais às comunidades ou o histórico de reacções e seguimentos.
