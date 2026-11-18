import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("regista, confirma, publica, recupera e elimina uma conta", async ({ page, request, browser }) => {
  const id = randomUUID().slice(0, 8);
  const slug = `ana-${id}`;
  const email = `${slug}@example.com`;
  const password = "Palavra-passe de ensaio";
  const newPassword = "Outra palavra-passe de ensaio";
  const mailBase = process.env.SSCIX_MAIL_URL ?? "http://localhost:8025";

  async function linkFromMail(route: string) {
    const url = new URL("/view/latest.txt", mailBase);
    url.searchParams.set("query", `to:${email}`);
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
  await page.getByLabel("Palavra-passe", { exact: false }).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("status")).toContainText("Consulte a sua caixa de email");

  await page.goto(await linkFromMail("confirmar-email"));
  await page.getByLabel("Palavra-passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Confirmar email" }).click();
  await expect(page.getByRole("status")).toContainText("Email confirmado");

  async function signIn(secret: string) {
    await page.goto("/entrar");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Palavra-passe", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Informação académica" })).toBeVisible();
  }

  await signIn(password);
  const visitor = await browser.newPage({ viewport: { width: 375, height: 800 } });
  try {
    const route = new URL(`/u/${slug}`, page.url()).href;
    expect((await visitor.goto(route))?.status()).toBe(404);
    await page.getByLabel("Instituição", { exact: true }).fill("Universidade de ensaio");
    await page.getByRole("checkbox", { name: /Tornar o perfil público/ }).check();
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByText("Perfil guardado.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Instituição", { exact: true })).toHaveValue("Universidade de ensaio");
    await visitor.goto(route);
    await expect(visitor.getByRole("heading", { name: "Ana Mateus" })).toBeVisible();
    await expect(visitor.getByText("Universidade de ensaio")).toBeVisible();
    await expect(visitor.getByText(email)).toHaveCount(0);
    await page.getByRole("checkbox", { name: /Tornar o perfil público/ }).uncheck();
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByRole("link", { name: /Ver perfil público/ })).toHaveCount(0);
    expect((await visitor.reload())?.status()).toBe(404);

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
    await page.getByText("Eliminar conta", { exact: true }).click();
    await page.getByLabel("Confirme a palavra-passe").fill(newPassword);
    await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(page).toHaveURL(/\/$/);
  } finally {
    await visitor.close();
  }
});
