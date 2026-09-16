import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";

async function expectBlocked(label: string, work: () => Promise<unknown>) {
  let blocked = false;
  try {
    await work();
  } catch {
    blocked = true;
  }
  assert.ok(blocked, `${label}: o PostgreSQL deveria bloquear vínculo entre tenants diferentes.`);
}

async function main() {
  const seedSlug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new Error("SEED_ADMIN_EMAIL é obrigatório.");

  const organizationA = await db.organization.findUnique({ where: { slug: seedSlug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organizationA && admin, "Seed base não encontrado.");

  const suffix = Date.now().toString();
  let organizationBId: string | null = null;
  let sellerUserId: string | null = null;
  let sellerMembershipId: string | null = null;
  let segmentId: string | null = null;
  let clientId: string | null = null;
  let categoryId: string | null = null;
  let productId: string | null = null;

  try {
    const organizationB = await db.organization.create({
      data: { name: `Tenant Guard B ${suffix}`, slug: `tenant-guard-b-${suffix}` },
    });
    organizationBId = organizationB.id;

    const sellerUser = await db.user.create({
      data: { name: "Seller Tenant Guard", email: `seller-tenant-guard-${suffix}@example.test` },
    });
    sellerUserId = sellerUser.id;

    const sellerMembership = await db.membership.create({
      data: {
        organizationId: organizationA.id,
        userId: sellerUser.id,
        role: "SELLER",
      },
    });
    sellerMembershipId = sellerMembership.id;

    const segment = await db.clientSegment.create({
      data: { organizationId: organizationA.id, name: `Segment Guard ${suffix}` },
    });
    segmentId = segment.id;

    const client = await db.client.create({
      data: {
        organizationId: organizationA.id,
        segmentId: segment.id,
        responsibleSellerMembershipId: sellerMembership.id,
        name: "Cliente Tenant Guard",
        documentType: "CPF",
        document: `guard-${suffix}`,
        whatsapp: `55719${suffix.slice(-8)}`,
        email: `client-tenant-guard-${suffix}@example.test`,
      },
    });
    clientId = client.id;

    const category = await db.productCategory.create({
      data: { organizationId: organizationA.id, name: `Category Guard ${suffix}` },
    });
    categoryId = category.id;

    const product = await db.product.create({
      data: {
        organizationId: organizationA.id,
        categoryId: category.id,
        name: "Produto Tenant Guard",
        sku: `GUARD-${suffix}`,
        brandManufacturer: "Guard",
        description: "Produto de validação de isolamento no banco.",
        costPrice: new Prisma.Decimal("10.00"),
        salePrice: new Prisma.Decimal("20.00"),
        unitMeasure: "UN",
      },
    });
    productId = product.id;

    const triggerCount = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname LIKE 'tenant_guard_%'
    `;
    assert.ok(Number(triggerCount[0]?.count ?? 0) >= 20, "Guards de tenant não foram instalados no PostgreSQL.");

    await expectBlocked("sessão sem membership", () =>
      db.session.create({
        data: {
          tokenHash: `tenant-guard-session-${suffix}`,
          userId: admin.id,
          activeOrganizationId: organizationB.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    );

    await expectBlocked("cliente com segmento de outro tenant", () =>
      db.client.create({
        data: {
          organizationId: organizationB.id,
          segmentId: segment.id,
          name: "Cliente Inválido",
          documentType: "CPF",
          document: `guard-invalid-${suffix}`,
          whatsapp: "5571999999999",
          email: `invalid-client-${suffix}@example.test`,
        },
      }),
    );

    await expectBlocked("endereço apontando para cliente de outro tenant", () =>
      db.clientAddress.create({
        data: {
          organizationId: organizationB.id,
          clientId: client.id,
          postalCode: "44470000",
          street: "Rua Guard",
          number: "1",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR",
        },
      }),
    );

    await expectBlocked("produto com categoria de outro tenant", () =>
      db.product.create({
        data: {
          organizationId: organizationB.id,
          categoryId: category.id,
          name: "Produto Inválido",
          sku: `GUARD-INVALID-${suffix}`,
          brandManufacturer: "Guard",
          description: "Deve ser rejeitado.",
          costPrice: new Prisma.Decimal("1.00"),
          salePrice: new Prisma.Decimal("2.00"),
          unitMeasure: "UN",
        },
      }),
    );

    await expectBlocked("estoque apontando para produto de outro tenant", () =>
      db.productStock.create({
        data: {
          organizationId: organizationB.id,
          productId: product.id,
          quantity: new Prisma.Decimal("1"),
          minimum: new Prisma.Decimal("0"),
          maximum: new Prisma.Decimal("10"),
        },
      }),
    );

    await expectBlocked("venda apontando para cliente/vendedora de outro tenant", () =>
      db.sale.create({
        data: {
          organizationId: organizationB.id,
          clientId: client.id,
          sellerMembershipId: sellerMembership.id,
          channel: "WHATSAPP",
        },
      }),
    );

    console.log("✓ guards de tenant instalados no PostgreSQL");
    console.log("✓ sessão sem membership bloqueada no banco");
    console.log("✓ relações cliente/segmento/endereço cross-tenant bloqueadas");
    console.log("✓ relações produto/categoria/estoque cross-tenant bloqueadas");
    console.log("✓ venda cross-tenant bloqueada antes da persistência");
  } finally {
    if (productId) await db.product.deleteMany({ where: { id: productId } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId } });
    if (segmentId) await db.clientSegment.deleteMany({ where: { id: segmentId } });
    if (sellerMembershipId) await db.membership.deleteMany({ where: { id: sellerMembershipId } });
    if (sellerUserId) await db.user.deleteMany({ where: { id: sellerUserId } });
    if (organizationBId) await db.organization.deleteMany({ where: { id: organizationBId } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
