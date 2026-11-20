# SSciX · Scientific Social Connection

A SSciX é a rede académica do ecossistema Sussurros do Saber. A versão **0.1.0** inclui contas por email e um primeiro perfil académico persistente, com interface em português de Moçambique.

## Publicar no Render

1. Prepare um fornecedor de email transaccional com SMTP autenticado e STARTTLS na porta 587. Verifique o domínio ou endereço remetente junto do fornecedor.
2. No [painel do Render](https://dashboard.render.com/), escolha **New → Blueprint** e seleccione o repositório SSciX, a branch `main` e o ficheiro `render.yaml`. Reveja os custos dos dois serviços Starter e da base de dados Basic antes de aplicar.
3. Preencha `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` no Render. Em `APP_ORIGIN`, indique a origem HTTPS pública do frontend, sem caminho. Se ainda não souber o endereço definitivo, introduza o endereço previsto e corrija-o no serviço `sscix-api` assim que o Render atribuir o endereço a `sscix-web`.
4. Quando os serviços estiverem activos, abra `/api/v1/health` no endereço público. A resposta esperada é `{"status":"ok"}`. Crie uma conta de ensaio, confirme o email, entre e guarde um perfil. Reabra o perfil para confirmar que os dados foram guardados.

O Blueprint liga o frontend à API e a API ao PostgreSQL pela rede privada. A API aplica as migrações no arranque.

## Executar localmente

Com Docker e o plugin Docker Compose, execute na pasta que contém `compose.yaml`:

```sh
docker compose up --build
```

| Serviço | Endereço |
| --- | --- |
| SSciX | [http://localhost:3000](http://localhost:3000) |
| Caixa de correio de desenvolvimento | [http://localhost:8025](http://localhost:8025) |
| Especificação da API | [http://localhost:3000/api/v1/openapi.json](http://localhost:3000/api/v1/openapi.json) |
| Swagger UI | [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs) |

1. Crie uma conta na SSciX e abra a mensagem de confirmação no Mailpit.
2. Abra o link recebido e introduza a palavra-passe do registo.
3. Entre e abra **Meu perfil**. Preencha os dados académicos e guarde.
4. Para testar o endereço público, ative **Tornar o perfil público**, guarde e abra o link numa janela privada. Volte a desativar a opção para retirar o perfil da vista pública.

O Mailpit recebe mensagens locais sem as encaminhar para destinatários reais. O PostgreSQL conserva as contas e os perfis no volume `db-data` quando os serviços são parados com `docker compose down`. O backend aplica as migrações antes de aceitar pedidos.

## Executar com serviços instalados na máquina

Pré-requisitos: Python 3.12, Node.js 24, PostgreSQL 17 ou posterior e um servidor SMTP local. Crie uma base de dados vazia e ajuste o endereço e as credenciais abaixo.

```sh
cd api
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
export DATABASE_URL='postgresql+psycopg://sscix:sscix@127.0.0.1:5432/sscix'
export APP_ORIGIN='http://localhost:3000'
export SMTP_HOST='127.0.0.1'
export SMTP_PORT='1025'
alembic upgrade head
uvicorn app.main:app --port 8000 --no-proxy-headers
```

Noutro terminal, a partir da raiz:

```sh
cd web
npm ci
npm run dev
```

O frontend encaminha a API para `http://127.0.0.1:8000` por defeito. Configure `API_INTERNAL_URL` se o serviço estiver noutro endereço. Use o mesmo hostname e porta de `APP_ORIGIN` ao aceder à aplicação, pois a API valida esta origem em pedidos que alteram dados.

## Testes

Use uma base PostgreSQL dedicada e vazia para os testes da API. A suite aplica a migração inicial e testa o ciclo da conta, a privacidade do perfil e a validação de pedidos. A entrega de email é substituída por uma caixa de teste apenas nestes testes.

```sh
cd api
python -m pip install -r requirements-test.txt
export SSCIX_TEST_DATABASE_URL='postgresql+psycopg://sscix:sscix@127.0.0.1:5432/sscix_test'
python -m pytest -q
```

Com a aplicação e o Mailpit em execução, o teste de navegador cria e elimina uma conta de ensaio. Use os endereços predefinidos do Compose ou indique `SSCIX_WEB_URL` e `SSCIX_MAIL_URL`.

```sh
cd web
npm ci
npx playwright install chromium
npm run test:e2e
npm run build
```

Consulte [a arquitetura e o plano de implementação](docs/arquitetura.md) para o modelo de dados, o contrato HTTP e a evolução por etapas.

## Administração da SSciX

Consulte [o guia de administração](docs/administracao.md) para configurar o primeiro acesso, atribuir funções e interpretar os indicadores.
