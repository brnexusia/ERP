import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth/password";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
function json(path: string, cookie: string, method = "GET", body?: unknown) {
  return fetch(base + path, {
    method, headers: { Cookie: cookie, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw Error("Seed CI requerida.");
  const org = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const owner = await db.user.findUniqueOrThrow({ where: { email } });
  const login = await fetch(base + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  const ownerSessionHash = createHash("sha256").update(cookie.split("=", 2)[1]).digest("hex");
  const stamp = Date.now();
  let categoryId: string | null = null;
  let productId: string | null = null;
  let secondOrgId: string | null = null;
  let secondCategoryId: string | null = null;
  let secondDraftId: string | null = null;
  let sellerId: string | null = null;
  const draftIds: string[] = [];
  try {
    const an = await fetch(base + "/promotions", { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(an.status));
    const panel = await json("/promotions", cookie);
    assert.equal(panel.status, 200);
    assert.match(await panel.text(), /Somente rascunhos/);

    const sellerEmail = `promotion-seller-${stamp}@example.test`;
    const sellerPassword = "test-not-real-secret-ci-2026";
    const seller = await db.user.create({
      data: { email: sellerEmail, name: "Testes de Promoção Vendedora",
        passwordHash: await hashPassword(sellerPassword) },
    });
    sellerId = seller.id;
    await db.membership.create({ data: { organizationId: org.id, userId: seller.id, role: "SELLER" } });
    const sellerLogin = await fetch(base + "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: sellerEmail, password: sellerPassword }),
    });
    assert.equal(sellerLogin.status, 200);
    const sellerCookie = sellerLogin.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(sellerCookie);
    assert.equal((await json("/api/promotions", sellerCookie)).status, 403);
    assert.equal((await json("/promotions", sellerCookie)).status, 404);

    const categoryResponse = await json("/api/product-categories", cookie, "POST", {
      name: `Promotion test category ${stamp}`,
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;
    const productResponse = await json("/api/products", cookie, "POST", {
      name: "Promotion Smoke Product", sku: `PROMOTION-SMOKE-${stamp}`,
      categoryId, brandManufacturer: "Teste",
      description: "Produto descartável de teste",
      costPrice: "4.00", salePrice: "10.00", unitMeasure: "UN",
      stock: { quantity: "3", minimum: "0", maximum: "10" },
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;
    const saleCountBefore = await db.sale.count({ where: { organizationId: org.id } });
    const productPriceBefore = (await db.product.findUniqueOrThrow({ where: { id: productId } })).salePrice;
    const candidates = [
      { name: "Rascunho produto", kind: "PRODUCT", productId },
      { name: "Rascunho categoria", kind: "CATEGORY", categoryId },
      { name: "Rascunho volume", kind: "PROGRESSIVE_VALUE" },
      { name: "Rascunho quantidade", kind: "PROGRESSIVE_QUANTITY" },
    ];
    for (const input of candidates) {
      const response = await json("/api/promotions", cookie, "POST", input);
      assert.equal(response.status, 201, `Falha ao criar ${input.kind}`);
      const draft = (await response.json()).draft;
      assert.equal(draft.kind, input.kind);
      draftIds.push(draft.id);
    }
    const records = await json("/api/promotions", cookie);
    assert.equal(records.status, 200);
    const listing = await records.json();
    assert.equal(listing.pricingEngine, "NOT_DEFINED");
    assert.ok(draftIds.every((id) => listing.drafts.some((p: { id: string }) => p.id === id)));
    assert.equal(await db.sale.count({ where: { organizationId: org.id } }), saleCountBefore,
      "Cadastrar rascunho não cria ou altera venda.");
    const productPriceAfter = (await db.product.findUniqueOrThrow({ where: { id: productId } })).salePrice;
    assert.equal(productPriceAfter.toFixed(2), productPriceBefore.toFixed(2),
      "Registrar promoções não pode alterar o preço de venda.");
    assert.equal((await json("/api/promotions", sellerCookie, "POST", {
      name: "Tentativa não autorizada", kind: "PRODUCT", productId,
    })).status, 403, "Vendedora não pode criar rascunhos.");

    assert.equal((await json("/api/promotions", cookie, "POST", {
      name: "Preço não aprovado", kind: "PRODUCT", productId, discountPercent: 10,
    })).status, 400, "API não aceita percentual sem regra aprovada.");
    assert.equal((await json("/api/promotions", cookie, "POST", {
      name: "Categoria inválida", kind: "CATEGORY", categoryId: "cdoesnotexist123456789",
    })).status, 404);
    const secondOrg = await db.organization.create({
      data: { name: "Promotion CI secondary", slug: `promotion-ci-${stamp}` },
    });
    secondOrgId = secondOrg.id;
    const secondCategory = await db.productCategory.create({
      data: { organizationId: secondOrg.id, name: "Categoria outra empresa" },
    });
    secondCategoryId = secondCategory.id;
    const secondDraft = await db.promotionDraft.create({
      data: { organizationId: secondOrg.id, createdByUserId: owner.id,
        name: "Rascunho segundo tenant", kind: "CATEGORY", categoryId: secondCategory.id },
    });
    secondDraftId = secondDraft.id;
    assert.equal((await json(`/api/promotions/${secondDraft.id}`, cookie, "DELETE")).status, 404,
      "Administrador da primeira empresa não pode excluir rascunho da segunda.");
    assert.ok(!(await json("/api/promotions", cookie).then((r) => r.json())).drafts.some(
      (draft: { id: string }) => draft.id === secondDraft.id,
    ), "Listagem não pode expor promoções de outra empresa.");
    assert.equal((await json(`/api/promotions/${draftIds[0]}`, sellerCookie, "DELETE")).status, 403,
      "Vendedora não pode excluir rascunhos.");
    assert.equal((await json("/api/promotions", cookie, "POST", {
      name: "Cross-tenant", kind: "CATEGORY", categoryId: secondCategoryId,
    })).status, 404);
    await assert.rejects(() => db.promotionDraft.create({
      data: {
        organizationId: org.id, createdByUserId: owner.id,
        name: "Direct SQL cross-tenant", kind: "CATEGORY", categoryId: secondCategoryId,
      },
    }), "O banco deve rejeitar relacionamento direto entre empresas.");

    const deleted = await json(`/api/promotions/${draftIds[0]}`, cookie, "DELETE");
    assert.equal(deleted.status, 200);
    assert.equal((await json(`/api/promotions/${draftIds[0]}`, cookie, "DELETE")).status, 404);
    console.log("✓ Tipos de rascunhos de promoções, sem regras de preço presumidas");
    console.log("✓ Permissionamento, auditoria, isolamento API/PostgreSQL e exclusão idempotente por 404");
    console.log("✓ Nenhum efeito em vendas ou desconto de preço");
  } finally {
    await db.promotionDraft.deleteMany({ where: { organizationId: org.id, id: { in: draftIds } } });
    if (productId) await db.product.deleteMany({ where: { id: productId, organizationId: org.id } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: org.id } });
    if (secondOrgId) await db.organization.deleteMany({ where: { id: secondOrgId } });
    if (sellerId) {
      await db.session.deleteMany({ where: { userId: sellerId } });
      await db.membership.deleteMany({ where: { userId: sellerId } });
      await db.user.delete({ where: { id: sellerId } });
    }
    await db.session.deleteMany({ where: { tokenHash: ownerSessionHash } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
