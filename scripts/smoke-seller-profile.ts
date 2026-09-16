import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { getSellerProfile, SellerNotFoundError } from "../modules/sellers/service";

async function main() {
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  const organization = await db.organization.findUnique({ where: { slug } });
  const adminMembership = await db.membership.findFirst({
    where: { organizationId: organization?.id, role: "OWNER" },
  });
  assert.ok(organization && adminMembership, "Seed base não encontrado.");

  const suffix = Date.now();
  const sellerUser = await db.user.create({
    data: { name: "Vendedora Perfil Smoke", email: `seller-profile-${suffix}@example.test` },
  });
  const seller = await db.membership.create({
    data: { organizationId: organization.id, userId: sellerUser.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: seller.id,
      name: "Cliente Seller Profile Smoke",
      documentType: "CPF",
      document: `seller-profile-${suffix}`,
      whatsapp: `55${suffix}`,
      email: `seller-profile-client-${suffix}@example.test`,
    },
  });
  const paidAt = new Date();
  const sale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: seller.id,
      stage: "PAID",
      channel: "WHATSAPP",
      totalAmount: new Prisma.Decimal("75.00"),
      orderedAt: paidAt,
      paidAt,
    },
  });

  let secondOrganizationId: string | null = null;

  try {
    const context = {
      organizationId: organization.id,
      userId: adminMembership.userId,
      role: adminMembership.role,
    };
    const profile = await getSellerProfile(context, seller.id, {});
    assert.equal(profile.seller.membershipId, seller.id);
    assert.equal(profile.assignedClients.length, 1);
    assert.equal(profile.assignedClients[0].id, client.id);
    assert.equal(profile.performance.sales, 1);
    assert.equal(profile.performance.revenue.toFixed(2), "75.00");
    assert.equal(profile.performance.averageTicket.toFixed(2), "75.00");
    assert.equal(profile.performance.uniqueClients, 1);
    assert.equal(profile.performance.channels.WHATSAPP.sales, 1);
    assert.ok(Array.isArray(profile.goals));
    assert.equal(profile.goals.length, 0);
    assert.equal(profile.commissions.status, "PENDING_RULE_DEFINITION");

    const future = await getSellerProfile(context, seller.id, {
      start: new Date(Date.now() + 86_400_000),
    });
    assert.equal(future.performance.sales, 0);
    assert.equal(future.performance.revenue.toFixed(2), "0.00");

    const secondOrganization = await db.organization.create({
      data: { name: "Seller Profile CI Second", slug: `seller-profile-ci-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;
    await assert.rejects(
      () => getSellerProfile({ ...context, organizationId: secondOrganization.id }, seller.id, {}),
      SellerNotFoundError,
    );

    console.log("✓ perfil da vendedora reúne carteira e performance factual");
    console.log("✓ filtros de período preservam o histórico original");
    console.log("✓ perfil expõe metas configuradas sem inventar recorrência");
    console.log("✓ comissões permanecem pendentes sem fórmula inventada");
    console.log("✓ perfil da vendedora permanece isolado entre empresas");
  } finally {
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.sale.deleteMany({ where: { id: sale.id } });
    await db.client.deleteMany({ where: { id: client.id } });
    await db.membership.deleteMany({ where: { id: seller.id } });
    await db.user.deleteMany({ where: { id: sellerUser.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
