import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("regista, confirma, publica, recupera e elimina uma conta", async ({ page, request, browser }) => {
  const id = randomUUID().slice(0, 8);
  const slug = `ana-${id}`;
  const email = `${slug}@example.com`;
  const password = "Palavra-passe de ensaio";
  const newPassword = "Outra palavra-passe de ensaio";
  const mailBase = process.env.SSCIX_MAIL_URL ?? "http://localhost:8025";

  async function linkFromMail(route: string, recipient = email) {
    const url = new URL("/view/latest.txt", mailBase);
    url.searchParams.set("query", `to:${recipient}`);
    let link: string | undefined;
    await expect.poll(async () => {
      const response = await request.get(url.href);
      const text = response.ok() ? await response.text() : "";
      link = text.match(new RegExp(`https?://[^\\s]+/${route}#token=[0-9A-Za-z_-]{43}`))?.[0];
      return Boolean(link);
    }).toBe(true);
    return link!;
  }

  await page.goto("/");
  await page.getByRole("link", { name: "Criar conta" }).click();
  await page.getByLabel("Nome completo").fill("Ana Mateus");
  await page.getByLabel("Endereço público").fill(slug);
  await page.getByLabel("Email", { exact: true }).fill(email);
  const registrationPassword = page.getByLabel("Palavra-passe", { exact: true });
  await registrationPassword.fill(password);
  await page.getByRole("button", { name: "Mostrar palavra-passe" }).click();
  await expect(registrationPassword).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar palavra-passe" }).click();
  await expect(registrationPassword).toHaveAttribute("type", "password");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("status")).toContainText("Consulte a sua caixa de email");

  await page.goto(await linkFromMail("confirmar-email"));
  await page.getByLabel("Palavra-passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Confirmar email" }).click();
  await expect(page.getByRole("status")).toContainText("Email confirmado");
  await page.getByLabel("Pesquisar temas").fill("educacao");
  await page.getByRole("checkbox", { name: "Educação" }).check();
  await page.getByRole("button", { name: "Guardar e continuar" }).click();
  await expect(page.getByRole("heading", { name: "Informação académica" })).toBeVisible();

  async function signIn(secret: string) {
    await page.goto("/entrar");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Palavra-passe", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Informação académica" })).toBeVisible();
  }

  const visitor = await browser.newPage({ viewport: { width: 375, height: 800 } });
  try {
    const route = new URL(`/u/${slug}`, page.url()).href;
    await visitor.goto(route);
    await expect(visitor).toHaveURL(/\/entrar$/);
    await page.getByLabel("Instituição", { exact: true }).fill("Universidade de ensaio");
    await page.getByRole("checkbox", { name: /Tornar o perfil público/ }).check();
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByText("Perfil guardado.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Instituição", { exact: true })).toHaveValue("Universidade de ensaio");
    for (const path of ["/rede", "/comunidades", "/mensagens", "/pessoas", "/notificacoes", "/perfil"]) {
      const response = await visitor.request.get(new URL(path, route).href, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(new URL(response.headers().location, route).pathname).toBe("/entrar");
    }
    const peerSlug = `celia-${id}`;
    const peerEmail = `${peerSlug}@example.com`;
    const origin = new URL(page.url()).origin;
    const headers = { Origin: origin };
    const peer = visitor.request;
    const peerRegistration = await peer.post(origin + "/api/v1/auth/register", {
      headers, data: { name: "Célia Chissano", slug: peerSlug, email: peerEmail, password, accept_terms: true },
    });
    expect(peerRegistration.status()).toBe(202);
    const token = new URL(await linkFromMail("confirmar-email", peerEmail)).hash.slice("#token=".length);
    expect((await peer.post(origin + "/api/v1/auth/verify", { headers, data: { token, password } })).status()).toBe(204);
    await visitor.goto(route);
    await expect(visitor.getByRole("heading", { name: "Ana Mateus" })).toBeVisible();
    await expect(visitor.getByText("Universidade de ensaio", { exact: true })).toBeVisible();
    await expect(visitor.getByText(email)).toHaveCount(0);
    expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect(await visitor.locator(".network-layout").evaluate((layout) =>
      getComputedStyle(layout).gridTemplateColumns.split(" ").length)).toBe(1);
    const { email: _email, ...peerProfile } = await (await peer.get(origin + "/api/v1/profiles/me")).json();
    expect((await peer.put(origin + "/api/v1/profiles/me", {
      headers, data: { ...peerProfile, keywords: ["Educação"], is_public: true },
    })).status()).toBe(200);
    await page.goto("/comunidades");
    await page.getByRole("button", { name: "Criar comunidade" }).click();
    const communityForm = page.getByRole("dialog", { name: "Criar comunidade" });
    await communityForm.getByLabel("Nome", { exact: true }).fill(`Educação ${id}`);
    await communityForm.getByLabel("Âmbito da comunidade").fill("Investigação e debate académico");
    const communityPhoto = { name: "comunidade.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kv9sAAAAASUVORK5CYII=", "base64") };
    await communityForm.getByLabel(/Fotografia da comunidade/).setInputFiles(communityPhoto);
    await communityForm.getByRole("button", { name: "Criar comunidade" }).click();
    await expect(communityForm).toBeHidden();
    const communitySearch = page.getByRole("searchbox", { name: "Pesquisar comunidades" });
    await communitySearch.fill("inexistente");
    await expect(page.getByText("Nenhuma comunidade encontrada.")).toBeVisible();
    await communitySearch.fill(`educacao ${id}`);
    await page.getByRole("link", { name: new RegExp(`Educação ${id}`) }).click();
    await expect(page.getByRole("heading", { name: `Educação ${id}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sobre a comunidade" })).toBeVisible();
    const communityImage = page.locator(".community-detail-hero img");
    await expect(communityImage).toBeVisible();
    const photoUrl = new URL((await communityImage.getAttribute("src"))!, origin).href;
    expect((await peer.get(photoUrl)).headers()["content-type"]).toBe("image/png");
    expect((await peer.put(photoUrl, { headers, data: { photo: "" } })).status()).toBe(403);
    await page.getByRole("button", { name: "Remover fotografia" }).click();
    await expect(page.getByText("Fotografia removida.")).toBeVisible();
    await expect(communityImage).toHaveCount(0);
    await page.getByLabel(/Fotografia da comunidade/).setInputFiles(communityPhoto);
    await page.getByRole("button", { name: "Adicionar fotografia" }).click();
    await expect(page.getByText("Fotografia guardada.")).toBeVisible();
    await expect(communityImage).toBeVisible();
    await expect(page.getByText("Ainda não há debates nesta comunidade.")).toBeVisible();
    await page.getByLabel("Criar publicação").fill("Primeiro debate da comunidade.");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByText("Primeiro debate da comunidade.")).toBeVisible();
    await page.getByRole("link", { name: "Todas as comunidades" }).click();
    await expect(page).toHaveURL(/\/comunidades$/);
    await page.goto("/rede");
    const topMenu = page.getByLabel("Abrir menu", { exact: true });
    await topMenu.click();
    const topNavigation = page.getByRole("navigation", { name: "Navegação principal" });
    for (const name of ["Guardados", "Definições", "Centro de ajuda"]) {
      await expect(topNavigation.getByRole("link", { name, exact: true })).toHaveCSS("color", "rgb(0, 29, 57)");
    }
    await topMenu.click();
    expect(await page.locator(".network-layout").evaluate((layout) =>
      getComputedStyle(layout).gridTemplateColumns.split(" ").length)).toBe(3);
    await page.getByRole("button", { name: "Criar publicação", exact: true }).click();
    const publication = page.getByRole("dialog", { name: "Criar publicação" });
    await publication.getByLabel("Criar publicação").fill(`Primeira publicação académica. @${peerSlug}`);
    await publication.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(publication).toBeHidden();
    await expect(page.getByText("Primeira publicação académica.")).toBeVisible();
    const desktopViewport = page.viewportSize()!;
    await page.setViewportSize({ width: 1280, height: 540 });
    const header = page.locator(".site-header");
    await expect(page.locator(".site-footer")).toBeHidden();
    const fixedRails = page.locator(".network-rail, .network-context");
    expect(await fixedRails.evaluateAll((rails) => rails.map((rail) => getComputedStyle(rail).position)))
      .toEqual(["sticky", "sticky"]);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect((await header.boundingBox())!.y).toBe(0);
    await expect(page.locator(".site-footer")).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize(desktopViewport);
    const firstPost = page.getByRole("article").filter({ hasText: "Primeira publicação académica." });
    await firstPost.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(firstPost.getByRole("button", { name: "Guardado", exact: true })).toBeVisible();
    await page.goto("/guardados");
    await expect(page.getByRole("navigation", { name: "Ligações do rodapé" })).toBeVisible();
    await expect(page.getByText("Primeira publicação académica.")).toBeVisible();
    await page.getByRole("button", { name: "Com imagem" }).click();
    await expect(page.getByText("Nenhuma publicação neste filtro.")).toBeVisible();
    await page.getByRole("button", { name: "Ver todas" }).click();
    await page.getByRole("button", { name: "Remover dos guardados" }).click();
    await expect(page.getByText("Ainda não guardou publicações.")).toBeVisible();
    await page.getByRole("link", { name: "Explorar o feed" }).click();
    const recommendation = page.getByRole("listitem").filter({ hasText: "Célia Chissano" });
    await recommendation.getByRole("button", { name: "Seguir", exact: true }).click();
    await expect(recommendation.getByRole("button", { name: "Deixar de seguir" })).toBeVisible();
    const headerSearch = page.getByRole("searchbox", { name: "Pesquisar na SSciX", exact: true });
    await headerSearch.fill("Célia Chissano");
    await headerSearch.press("Enter");
    await expect(page).toHaveURL(/\/pessoas\?q=/);
    await page.getByRole("link", { name: "Célia Chissano", exact: true }).click();
    await expect(page.getByText("1 Seguidores")).toBeVisible();
    await page.getByRole("link", { name: "Enviar mensagem" }).click();
    const thread = page.getByRole("region", { name: "Conversa", exact: true });
    await expect(page.getByRole("searchbox", { name: "Pesquisar conversas" })).toBeVisible();
    await thread.getByRole("button", { name: "Tudo bem?" }).click();
    await expect(page.getByLabel("Escrever mensagem")).toHaveValue("Tudo bem?");
    await page.getByLabel("Escrever mensagem").fill("Olá, Célia. Vamos colaborar?");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(thread.getByText("Olá, Célia. Vamos colaborar?")).toBeVisible();
    await visitor.goto(origin + "/mensagens");
    const inboxSearch = visitor.getByRole("searchbox", { name: "Pesquisar conversas" });
    await inboxSearch.fill("Sem resultado");
    await expect(visitor.getByText("Nenhuma conversa encontrada.")).toBeVisible();
    await inboxSearch.fill("Ana");
    await visitor.getByRole("link", { name: /Ana Mateus/ }).click();
    await expect(inboxSearch).toBeHidden();
    await expect(visitor.getByRole("link", { name: "Voltar às mensagens" })).toBeVisible();
    await expect(visitor.getByRole("region", { name: "Conversa", exact: true }).getByText("Olá, Célia. Vamos colaborar?")).toBeVisible();
    await visitor.goto(route);
    await expect(visitor.getByText("Primeira publicação académica.")).toBeVisible();
    const notificationTrigger = visitor.getByRole("button", { name: "Notificações", exact: true });
    await notificationTrigger.click();
    const notificationPanel = visitor.getByRole("region", { name: "Notificações" });
    await expect(notificationPanel).toBeVisible();
    await expect(visitor).toHaveURL(route);
    await notificationPanel.getByRole("button", { name: "Não lidas" }).click();
    await expect(notificationPanel.getByRole("link", { name: /Ana Mateus/ })).toBeVisible();
    await notificationPanel.getByRole("button", { name: "Marcar como lida" }).click();
    await expect(notificationPanel.getByText("Não tem notificações por ler.")).toBeVisible();
    await notificationPanel.getByRole("button", { name: "Todas" }).click();
    await expect(notificationPanel.getByRole("link", { name: /Ana Mateus/ })).toBeVisible();
    await visitor.keyboard.press("Escape");
    await expect(notificationPanel).toBeHidden();
    await notificationTrigger.click();
    await notificationPanel.getByRole("link", { name: "Ver tudo" }).click();
    await expect(visitor).toHaveURL(/\/notificacoes$/);
    await expect(notificationPanel).toBeHidden();
    await page.goto("/perfil");
    await page.getByRole("checkbox", { name: /Tornar o perfil público/ }).uncheck();
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByRole("link", { name: /Ver perfil público/ })).toHaveCount(0);
    expect((await visitor.goto(route))?.status()).toBe(404);

    await page.getByRole("button", { name: "Terminar sessão" }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await signIn(password);
    await page.goto("/recuperar");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status")).toContainText("receberá um link");
    await page.goto(await linkFromMail("nova-palavra-passe"));
    await page.getByLabel("Palavra-passe", { exact: false }).fill(newPassword);
    await page.getByRole("button", { name: "Guardar palavra-passe" }).click();
    await expect(page.getByRole("status")).toContainText("Palavra-passe atualizada");
    await signIn(newPassword);
    await page.goto("/definicoes");
    await expect(page.getByRole("link", { name: /Editar perfil/ })).toBeVisible();
    await page.getByRole("button", { name: "Acesso e segurança" }).click();
    await expect(page.getByText("Palavra-passe", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Gestão da conta" }).click();
    await page.getByText("Eliminar conta", { exact: true }).click();
    await page.getByLabel("Confirme a palavra-passe").fill(newPassword);
    await page.getByLabel("Escreva ELIMINAR para confirmar").fill("ELIMINAR");
    await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(page).toHaveURL(/\/$/);
  } finally {
    await visitor.close();
  }
});
