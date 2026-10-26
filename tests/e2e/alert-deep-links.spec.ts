import { test, expect } from "@playwright/test";
import { db } from "../../lib/db";

/**
 * Exercise the complete operator path: a factual alert opens the matching
 * client/product detail. Queries do not bypass tenant authorization.
 *
 * Fixtures live only in the disposable CI tenant and are removed in finally.
 */
test("alerta abre exatamente o cliente inativo e o produto com estoque baixo", async ({ page }, testInfo) => {
  const tenant = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw Error("Playwright exige credenciais do tenant CI.");

  const stamp = `${Date.now()}-${testInfo.project.name}`;
  const clientName = `Cliente Deep Link ${stamp}`;
  const productName = `Estoque Deep Link ${stamp}`;
  let clientId: string | null = null;
  let categoryId: string | null = null;
  let productId: string | null = null;

  try {
    const client = await db.client.create({
      data: {
        organizationId: tenant.id,
        name: clientName,
        documentType: "CPF",
        document: `link-${stamp}`,
        whatsapp: `link-${stamp}`,
        email: `alert-link-${stamp}@example.test`,
        inactivityDaysOverride: 1,
        createdAt: new Date(Date.now() - 4 * 86_400_000),
      },
    });
    clientId = client.id;
    const category = await db.productCategory.create({
      data: { organizationId: tenant.id, name: `Categoria deep link ${stamp}` },
    });
    categoryId = category.id;
    const product = await db.product.create({
      data: {
        organizationId: tenant.id,
        categoryId: category.id,
        name: productName,
        sku: `DEEP-${stamp}`,
        brandManufacturer: "Teste",
        description: "Verifica abertura de um item a partir da central de alertas.",
        costPrice: "12.00",
        salePrice: "29.90",
        unitMeasure: "UN",
        stock: {
          create: {
            organizationId: tenant.id,
            quantity: "2",
            minimum: "3",
            maximum: "30",
          },
        },
      },
    });
    productId = product.id;

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });

    await page.goto("/alerts");
    const clientCard = page.locator("article").filter({ hasText: clientName });
    await expect(clientCard).toBeVisible();
    await clientCard.getByRole("link", { name: "Consultar cliente" }).click();
    await expect(page).toHaveURL(new RegExp(`/clients\\?client=${clientId}$`));
    await expect(page.getByRole("heading", { name: clientName, level: 1 })).toBeVisible();
    await page.screenshot({ path: `test-results/${testInfo.project.name}-alert-client-detail.png`, fullPage: true });

    await page.goto("/alerts");
    const productCard = page.locator("article").filter({ hasText: productName });
    await expect(productCard).toBeVisible();
    await productCard.getByRole("link", { name: "Consultar estoque" }).click();
    await expect(page).toHaveURL(new RegExp(`/products\\?product=${productId}$`));
    await expect(page.getByRole("heading", { name: `Produto · ${productName}`, level: 2 })).toBeVisible();
    await page.screenshot({ path: `test-results/${testInfo.project.name}-alert-product-detail.png`, fullPage: true });
  } finally {
    if (productId) await db.product.deleteMany({ where: { organizationId: tenant.id, id: productId } });
    if (categoryId) await db.productCategory.deleteMany({ where: { organizationId: tenant.id, id: categoryId } });
    if (clientId) await db.client.deleteMany({ where: { organizationId: tenant.id, id: clientId } });
  }
});
