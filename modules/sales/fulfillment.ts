import { FulfillmentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { SaleNotFoundError, SaleRuleError } from "@/modules/sales/service";

export type CheckedItem = { saleItemId: string; quantity: string };

async function serializable<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
  throw lastError;
}

function verifyEveryItem(
  saleItems: Array<{ id: string; quantity: Prisma.Decimal }>,
  input: CheckedItem[],
) {
  if (saleItems.length === 0 || saleItems.length !== input.length) {
    throw new SaleRuleError("Confira exatamente todos os itens do pedido.");
  }
  const expected = new Map(saleItems.map((item) => [item.id, item.quantity]));
  const received = new Set<string>();
  for (const item of input) {
    if (received.has(item.saleItemId) || !expected.has(item.saleItemId)) {
      throw new SaleRuleError("Lista de itens duplicada ou diferente do pedido.");
    }
    received.add(item.saleItemId);
    const quantity = new Prisma.Decimal(item.quantity);
    if (!quantity.equals(expected.get(item.saleItemId)!)) {
      throw new SaleRuleError("A quantidade conferida deve corresponder exatamente ao pedido.");
    }
  }
  return saleItems.map((item) => ({
    saleItemId: item.id, quantity: item.quantity.toFixed(3),
  }));
}

function fulfillmentInclude() {
  return {
    separatedBy: { select: { id: true, name: true } },
    verifiedBy: { select: { id: true, name: true } },
  };
}

export async function getSaleFulfillment(context: ClientAccessContext, saleId: string) {
  assertPermission(context.role, "sales:read");
  const sale = await db.sale.findFirst({
    where: { id: saleId, organizationId: context.organizationId },
    select: { id: true, fulfillmentRequired: true, stage: true },
  });
  if (!sale) throw new SaleNotFoundError();
  const fulfillment = await db.saleFulfillment.findFirst({
    where: { saleId, organizationId: context.organizationId },
    include: fulfillmentInclude(),
  });
  return { fulfillmentRequired: sale.fulfillmentRequired, fulfillment };
}

export async function separateSaleItems(
  context: ClientAccessContext,
  saleId: string,
  items: CheckedItem[],
) {
  assertPermission(context.role, "sales:write");
  return serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
      include: { items: true, delivery: { select: { id: true } } },
    });
    if (!sale) throw new SaleNotFoundError();
    if (sale.stage === "QUOTE") throw new SaleRuleError("Confirme o pedido antes de iniciar a separação.");
    if (sale.delivery) throw new SaleRuleError("O pedido já possui entrega registrada.");
    const existing = await tx.saleFulfillment.findUnique({ where: { saleId } });
    if (existing) throw new SaleRuleError("A separação já foi registrada para este pedido.");
    const snapshot = verifyEveryItem(sale.items, items);
    const fulfillment = await tx.saleFulfillment.create({
      data: {
        organizationId: context.organizationId,
        saleId,
        status: FulfillmentStatus.SEPARATED,
        separationItems: snapshot,
        separatedByUserId: context.userId,
      },
      include: fulfillmentInclude(),
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_ITEMS_SEPARATED",
        entityType: "SaleFulfillment",
        entityId: fulfillment.id,
        metadata: { saleId, itemCount: snapshot.length, items: snapshot },
      },
    });
    return fulfillment;
  });
}

export async function verifySeparatedSale(
  context: ClientAccessContext,
  saleId: string,
  items: CheckedItem[],
) {
  assertPermission(context.role, "sales:write");
  return serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
      include: { items: true, delivery: { select: { id: true } } },
    });
    if (!sale) throw new SaleNotFoundError();
    if (sale.stage === "QUOTE") throw new SaleRuleError("O orçamento ainda não foi confirmado.");
    if (sale.delivery) throw new SaleRuleError("A entrega já foi registrada.");
    const existing = await tx.saleFulfillment.findFirst({
      where: { organizationId: context.organizationId, saleId },
    });
    if (!existing || existing.status !== FulfillmentStatus.SEPARATED) {
      throw new SaleRuleError("A separação deve ser finalizada antes da conferência.");
    }
    if (existing.separatedByUserId === context.userId) {
      throw new SaleRuleError("A conferência deve ser feita por outro funcionário.");
    }
    const snapshot = verifyEveryItem(sale.items, items);
    const initial = existing.separationItems as CheckedItem[];
    if (!Array.isArray(initial) || initial.length !== snapshot.length ||
      initial.some((item, index) => item.saleItemId !== snapshot[index].saleItemId ||
        item.quantity !== snapshot[index].quantity)) {
      throw new SaleRuleError("Os produtos separados não correspondem à conferência.");
    }
    const fulfillment = await tx.saleFulfillment.update({
      where: { id: existing.id },
      data: {
        status: FulfillmentStatus.VERIFIED,
        verificationItems: snapshot,
        verifiedByUserId: context.userId,
        verifiedAt: new Date(),
      },
      include: fulfillmentInclude(),
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_ITEMS_VERIFIED",
        entityType: "SaleFulfillment",
        entityId: fulfillment.id,
        metadata: { saleId, itemCount: snapshot.length, items: snapshot,
          separatedByUserId: existing.separatedByUserId },
      },
    });
    return fulfillment;
  });
}
