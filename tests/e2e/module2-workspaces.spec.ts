import { test, expect, type Page } from "@playwright/test";

/**
 * Stage 2: real-browser acceptance of the four commercial workspaces.
 * Checks navigation, primary controls, response/error state, and mobile width.
 * The test never approves a closing, settles a payment or sends a message.
 */
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!email || !password) throw Error("O smoke da etapa 2 exige usuário do tenant descartável.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
}

async function noViewportOverflow(page: Page, section: string) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document, `${section}: documento deve respeitar largura mobile/desktop`)
    .toBeLessThanOrEqual(widths.viewport + 3);
  expect(widths.body, `${section}: body deve respeitar largura mobile/desktop`)
    .toBeLessThanOrEqual(widths.viewport + 3);
}

test("módulo 2: vendas, BI, comissões e SAC funcionam no navegador e em mobile", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await signIn(page);

  let response = await page.goto("/sales");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Vendas & Pedidos", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Histórico de vendas", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "+ Novo orçamento" }).click();
  await expect(page.getByRole("heading", { name: "Criar orçamento", level: 2 })).toBeVisible();
  await expect(page.getByText("Canal de venda")).toBeVisible();
  await noViewportOverflow(page, "Vendas e Pedidos");
  await page.screenshot({ path: `test-results/${testInfo.project.name}-module2-sales.png`, fullPage: true });

  response = await page.goto("/reports");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Relatórios & BI", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vendas por canal", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Desempenho por vendedora", level: 2 })).toBeVisible();
  await page.getByLabel("Início").fill("2026-01-01");
  await page.getByLabel("Fim").fill("2026-12-31");
  await page.getByRole("button", { name: "Atualizar relatório" }).click();
  await expect(page.getByRole("heading", { name: "Ranking de compradores", level: 2 })).toBeVisible();
  await noViewportOverflow(page, "Relatórios e BI");
  await page.screenshot({ path: `test-results/${testInfo.project.name}-module2-reports.png`, fullPage: true });

  response = await page.goto("/commissions");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Demonstrativo de comissões", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Competência")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comissões das vendedoras", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parcelas e comissões dos representantes", level: 2 })).toBeVisible();
  await noViewportOverflow(page, "Comissões");
  await page.screenshot({ path: `test-results/${testInfo.project.name}-module2-commissions.png`, fullPage: true });

  response = await page.goto("/support");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Atendimento & SAC", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Histórico de atendimentos", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "+ Registrar atendimento" }).click();
  await expect(page.getByRole("heading", { name: "Registrar contato com o cliente", level: 2 })).toBeVisible();
  await expect(page.getByLabel("Descrição do atendimento")).toBeVisible();
  await noViewportOverflow(page, "Atendimento e SAC");
  await page.screenshot({ path: `test-results/${testInfo.project.name}-module2-support.png`, fullPage: true });

  expect(browserErrors, "Nenhuma tela da etapa 2 pode disparar erro JavaScript não tratado").toEqual([]);
});
