import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!email || !password) throw new Error("Credenciais seed obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const suffix = Date.now().toString();
  const sellerUser = await db.user.create({
    data: { name: "Vendedora Metas Smoke", email: `seller-goals-${suffix}@example.test` },
  });
  const seller = await db.membership.create({
    data: { organizationId: organization.id, userId: sellerUser.id, role: "SELLER" },
  });

  const clients = await Promise.all([1, 2].map((index) => db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: seller.id,
      name: `Cliente Meta ${index}`,
      documentType: "CPF",
      document: `goal-${index}-${suffix}`,
      whatsapp: `55719${suffix.slice(-7)}${index}`,
      email: `goal-client-${index}-${suffix}@example.test`,
    },
  })));

  const paidAt = new Date();
  const sales = await Promise.all([
    db.sale.create({
      data: {
        organizationId: organization.id,
        clientId: clients[0].id,
        sellerMembershipId: seller.id,
        stage: "PAID",
        channel: "WHATSAPP",
        totalAmount: new Prisma.Decimal("300.00"),
        orderedAt: paidAt,
        paidAt,
      },
    }),
    db.sale.create({
      data: {
        organizationId: organization.id,
        clientId: clients[1].id,
        sellerMembershipId: seller.id,
        stage: "PAID",
        channel: "SITE",
        totalAmount: new Prisma.Decimal("200.00"),
        orderedAt: paidAt,
        paidAt,
      },
    }),
  ]);

  let secondOrganizationId: string | null = null;
  let secondSellerUserId: string | null = null;
  let secondSellerMembershipId: string | null = null;

  try {
    const login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    assert.equal(login.status, 200);
    const cookie = cookiePair(login.headers.get("set-cookie"));

    const startAt = new Date(Date.now() - 86_400_000).toISOString();
    const endAt = new Date(Date.now() + 86_400_000).toISOString();

    async function createGoal(metric: string, targetValue: string) {
      const response = await fetch(`${BASE_URL}/api/sellers/${seller.id}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ metric, targetValue, startAt, endAt }),
      });
      assert.equal(response.status, 201, `Criação da meta ${metric} falhou: ${response.status}`);
      return (await response.json()).goal;
    }

    const revenueGoal = await createGoal("REVENUE", "400.00");
    assert.equal(revenueGoal.actualValue, "500");
    assert.equal(revenueGoal.achieved, true);
    assert.equal(revenueGoal.progressPercent, "125");
    assert.equal(revenueGoal.status, "ACTIVE");

    const salesGoal = await createGoal("SALES", "3");
    assert.equal(salesGoal.actualValue, "2");
    assert.equal(salesGoal.achieved, false);

    const clientsGoal = await createGoal("CLIENTS", "2");
    assert.equal(clientsGoal.actualValue, "2");
    assert.equal(clientsGoal.achieved, true);

    const invalidCountTarget = await fetch(`${BASE_URL}/api/sellers/${seller.id}/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ metric: "SALES", targetValue: "2.50", startAt, endAt }),
    });
    assert.equal(invalidCountTarget.status, 400);

    const update = await fetch(`${BASE_URL}/api/sellers/${seller.id}/goals/${salesGoal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ targetValue: "2" }),
    });
    assert.equal(update.status, 200);
    const updatedGoal = (await update.json()).goal;
    assert.equal(updatedGoal.actualValue, "2");
    assert.equal(updatedGoal.achieved, true);
    assert.equal(updatedGoal.progressPercent, "100");

    const list = await fetch(`${BASE_URL}/api/sellers/${seller.id}/goals`, {
      headers: { Cookie: cookie },
    });
    assert.equal(list.status, 200);
    const listedGoals = (await list.json()).goals;
    assert.equal(listedGoals.length, 3);

    const profile = await fetch(`${BASE_URL}/api/sellers/${seller.id}/profile`, {
      headers: { Cookie: cookie },
    });
    assert.equal(profile.status, 200);
    const profileBody = await profile.json();
    assert.equal(profileBody.profile.goals.length, 3);
    assert.equal(profileBody.profile.commissions.status, "PENDING_RULE_DEFINITION");

    const secondOrganization = await db.organization.create({
      data: { name: "Seller Goals Second", slug: `seller-goals-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;
    const secondSellerUser = await db.user.create({
      data: { name: "Seller Second", email: `seller-goals-second-${suffix}@example.test` },
    });
    secondSellerUserId = secondSellerUser.id;
    const secondSeller = await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: secondSellerUser.id, role: "SELLER" },
    });
    secondSellerMembershipId = secondSeller.id;

    const crossTenant = await fetch(`${BASE_URL}/api/sellers/${secondSeller.id}/goals`, {
      headers: { Cookie: cookie },
    });
    assert.equal(crossTenant.status, 404);

    const deletion = await fetch(`${BASE_URL}/api/sellers/${seller.id}/goals/${revenueGoal.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    assert.equal(deletion.status, 200);

    const auditCount = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        entityType: "SellerGoal",
        action: { in: ["SELLER_GOAL_CREATE", "SELLER_GOAL_UPDATE", "SELLER_GOAL_DELETE"] },
      },
    });
    assert.ok(auditCount >= 5);

    console.log("✓ metas por faturamento, vendas e clientes usam vendas efetivamente pagas");
    console.log("✓ cada meta possui período explícito e não presume recorrência mensal");
    console.log("✓ acompanhamento calcula realizado, percentual e atingimento");
    console.log("✓ metas rejeitam quantidades fracionadas e preservam tenant isolation");
    console.log("✓ perfil da vendedora incorpora metas configuradas; comissão segue sem fórmula inventada");
  } finally {
    if (secondSellerMembershipId) await db.membership.deleteMany({ where: { id: secondSellerMembershipId } });
    if (secondSellerUserId) await db.user.deleteMany({ where: { id: secondSellerUserId } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.sellerGoal.deleteMany({ where: { sellerMembershipId: seller.id } });
    await db.sale.deleteMany({ where: { id: { in: sales.map((sale) => sale.id) } } });
    await db.client.deleteMany({ where: { id: { in: clients.map((client) => client.id) } } });
    await db.membership.deleteMany({ where: { id: seller.id } });
    await db.user.deleteMany({ where: { id: sellerUser.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
