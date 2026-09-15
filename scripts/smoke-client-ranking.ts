import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !password) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const seller = await db.user.create({
    data: { name: "Vendedora Ranking", email: `ranking-seller-${Date.now()}@example.test` },
  });
  const membership = await db.membership.create({
    data: { organizationId: organization.id, userId: seller.id, role: "SELLER" },
  });
  const timestamp = Date.now();
  const firstClient = await db.client.create({
    data: {
      organizationId: organization.id,
      name: "Cliente Ranking A",
      documentType: "CPF",
      document: `111111111${timestamp % 100}`,
      whatsapp: "5571999991301",
      email: `ranking-a-${timestamp}@example.test`,
    },
  });
  const secondClient = await db.client.create({
    data: {
      organizationId: organization.id,
      name: "Cliente Ranking B",
      documentType: "CPF",
      document: `222222222${timestamp % 100}`,
      whatsapp: "5571999991302",
      email: `ranking-b-${timestamp}@example.test`,
    },
  });

  const firstSale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: firstClient.id,
      sellerMembershipId: membership.id,
      stage: "PAID",
      channel: "WHATSAPP",
      totalAmount: "120.00",
      orderedAt: new Date(),
      paidAt: new Date(),
    },
  });
  const secondSale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: secondClient.id,
      sellerMembershipId: membership.id,
      stage: "PAID",
      channel: "SITE",
      totalAmount: "60.00",
      orderedAt: new Date(),
      paidAt: new Date(),
    },
  });

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  try {
    const response = await fetch(`${BASE_URL}/api/reports/clients/ranking`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 200, `Ranking de clientes falhou: ${response.status}`);
    const ranking = (await response.json()).report.ranking;
    const first = ranking.find((entry: { client: { id: string } }) => entry.client.id === firstClient.id);
    const second = ranking.find((entry: { client: { id: string } }) => entry.client.id === secondClient.id);
    assert.ok(first && second, "Os dois clientes deveriam aparecer no ranking.");
    assert.ok(first.rank < second.rank, "Cliente com maior valor comprado deve aparecer antes no ranking.");
    assert.equal(String(first.totalPurchased), "120");
    assert.equal(String(second.totalPurchased), "60");
    assert.equal(first.purchases, 1);
    assert.equal(second.purchases, 1);

    console.log("✓ ranking factual de clientes por valor comprado validado");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    await db.sale.deleteMany({ where: { id: { in: [firstSale.id, secondSale.id] } } });
    await db.client.deleteMany({ where: { id: { in: [firstClient.id, secondClient.id] } } });
    await db.membership.deleteMany({ where: { id: membership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
