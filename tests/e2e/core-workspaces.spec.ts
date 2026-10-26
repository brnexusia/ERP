import { test, expect, type Page } from "@playwright/test";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!email || !password) throw Error("Browser smoke exige credenciais do tenant CI.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Bem-vindo ao seu ERP/i })).toBeVisible();
}

async function checkNoViewportOverflow(page: Page, name: string) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(metrics.document, name + " deve caber na largura do viewport").toBeLessThanOrEqual(metrics.viewport + 3);
  expect(metrics.body, name + " não deve extravasar horizontalmente").toBeLessThanOrEqual(metrics.viewport + 3);
}

async function checkDashboardPanelSeparation(page: Page) {
  const rects = await page.locator(".dashboard-grid-main > .erp-panel").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
    }),
  );
  expect(rects, "Dashboard deve renderizar os painéis comercial e de canais").toHaveLength(2);
  const [left, right] = rects;
  const intersectionWidth = Math.max(0, Math.min(left.right, right.right) - Math.max(left.x, right.x));
  const intersectionHeight = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y));
  expect(intersectionWidth * intersectionHeight,
    "Painéis de performance e canais não podem se sobrepor, mesmo sem overflow da página").toBeLessThanOrEqual(1);
}

test("redireciona visitante anônimo para login", async ({ page }) => {
  await page.goto("/products");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("login, intervalo do dashboard e navegação pelos módulos", async ({ page }, testInfo) => {
  await signIn(page);
  await expect(page.getByText("Todo o histórico").first()).toBeVisible();

  await page.getByLabel("Data inicial").fill("2026-01-01");
  await page.getByLabel("Data final").fill("2026-12-31");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.locator(".stitch-period-pill")).toContainText("01/01/2026 a 31/12/2026");
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await expect(page.locator(".stitch-period-pill")).toHaveText("Todo o histórico");
  await checkNoViewportOverflow(page, "Dashboard Geral");
  await checkDashboardPanelSeparation(page);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-dashboard.png`, fullPage: true });

  for (const [path, heading] of [
    ["/clients", /Clientes/i],
    ["/products", /Produtos/i],
    ["/alerts", /Central de alertas/i],
    ["/reports", /Relatórios/i],
    ["/finance", /Financeiro/i],
    ["/integrations", /Integrações/i],
    ["/promotions", /Promoções/i],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), `A página ${path} não pode retornar erro HTTP.`).toBe(200);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await checkNoViewportOverflow(page, path);
    if (path === "/alerts") {
      await page.screenshot({
        path: `test-results/${testInfo.project.name}-alerts.png`,
        fullPage: true,
      });
    }
  }
});
