import { test, expect } from "@playwright/test";

const username = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

test("menu lateral mantém navegação separada do rodapé em telas baixas", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Valida sidebar vertical de desktop");

  if (!username || !password) throw Error("Credenciais descartáveis de CI obrigatórias.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(username);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  for (const height of [580, 620, 720, 900]) {
    await page.setViewportSize({ width: 1280, height });
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    const sidebar = page.locator(".erp-sidebar");
    const footer = page.locator(".erp-sidebar-footer");
    await expect(nav).toBeVisible();
    await expect(footer).toBeVisible();

    const info = await sidebar.evaluate((element) => {
      const navEl = element.querySelector<HTMLElement>(".erp-nav")!;
      const footerEl = element.querySelector<HTMLElement>(".erp-sidebar-footer")!;
      const brandEl = element.querySelector<HTMLElement>(".erp-brand")!;
      const navRect = navEl.getBoundingClientRect();
      const footerRect = footerEl.getBoundingClientRect();
      return {
        brandBottom: brandEl.getBoundingClientRect().bottom,
        navTop: navRect.top,
        navBottom: navRect.bottom,
        footerTop: footerRect.top,
        footerBottom: footerRect.bottom,
        sidebarBottom: element.getBoundingClientRect().bottom,
        clientHeight: navEl.clientHeight,
        scrollHeight: navEl.scrollHeight,
      };
    });
    expect(info.navTop, `brand/nav sem sobreposição a ${height}px`).toBeGreaterThanOrEqual(info.brandBottom - 1);
    expect(info.footerTop, `rodapé não se sobrepõe ao menu a ${height}px`).toBeGreaterThanOrEqual(info.navBottom - 1);
    expect(info.footerBottom, `rodapé visível a ${height}px`).toBeLessThanOrEqual(height + 1);
    expect(info.sidebarBottom, `sidebar cabe no viewport a ${height}px`).toBeLessThanOrEqual(height + 1);

    if (height === 580) {
      expect(info.scrollHeight, "Menu deve ser rolável em viewport baixo").toBeGreaterThan(info.clientHeight);
      await nav.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect(page.locator('.erp-nav a[href="/clients/settings"]')).toBeInViewport();
      await expect(footer).toBeInViewport();
    }
  }
});
