import { DeliveryMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type {
  SaleDeliveryInput,
  SupportRecordCreateInput,
} from "@/modules/customer-service/schema";

export class CustomerServiceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerServiceNotFoundError";
  }
}

export class CustomerServiceRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerServiceRuleError";
  }
}

async function requireClient(context: ClientAccessContext, clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: context.organizationId },
    select: { id: true },
  });
  if (!client) throw new CustomerServiceNotFoundError("Cliente não encontrado.");
  return client;
}

async function requireSale(context: ClientAccessContext, saleId: string) {
  const sale = await db.sale.findFirst({
    where: { id: saleId, organizationId: context.organizationId },
    select: { id: true, clientId: true, stage: true },
  });
  if (!sale) throw new CustomerServiceNotFoundError("Venda não encontrada.");
  return sale;
}

export async function listClientSupportRecords(context: ClientAccessContext, clientId: string) {
  assertPermission(context.role, "clients:read");
  await requireClient(context, clientId);

  return db.supportRecord.findMany({
    where: { organizationId: context.organizationId, clientId },
    include: {
      createdBy: { select: { id: true, name: true } },
      sale: {
        select: {
          id: true,
          stage: true,
          channel: true,
          totalAmount: true,
          quotedAt: true,
          orderedAt: true,
          paidAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createClientSupportRecord(
  context: ClientAccessContext,
  clientId: string,
  input: SupportRecordCreateInput,
) {
  assertPermission(context.role, "clients:write");
  await requireClient(context, clientId);

  if (input.saleId) {
    const sale = await requireSale(context, input.saleId);
    if (sale.clientId !== clientId) {
      throw new CustomerServiceRuleError("A venda informada não pertence a este cliente.");
    }
  }

  return db.$transaction(async (tx) => {
    const record = await tx.supportRecord.create({
      data: {
        organizationId: context.organizationId,
        clientId,
        saleId: input.saleId ?? null,
        kind: input.kind,
        content: input.content,
        createdByUserId: context.userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        sale: { select: { id: true, stage: true, channel: true, totalAmount: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_SUPPORT_RECORD_CREATE",
        entityType: "SupportRecord",
        entityId: record.id,
        metadata: {
          clientId,
          saleId: record.saleId,
          kind: record.kind,
        },
      },
    });

    return record;
  });
}

export async function getSaleDelivery(context: ClientAccessContext, saleId: string) {
  assertPermission(context.role, "sales:read");
  await requireSale(context, saleId);

  return db.saleDelivery.findFirst({
    where: { organizationId: context.organizationId, saleId },
  });
}

export async function saveSaleDelivery(
  context: ClientAccessContext,
  saleId: string,
  input: SaleDeliveryInput,
) {
  assertPermission(context.role, "sales:write");
  const sale = await requireSale(context, saleId);

  if (sale.stage === "QUOTE") {
    throw new CustomerServiceRuleError("A entrega só pode ser registrada depois que o orçamento virar pedido.");
  }

  const pickupRegisteredAt =
    input.method === DeliveryMethod.PICKUP ? input.pickupRegisteredAt : null;
  const trackingCode = input.method === DeliveryMethod.CORREIOS ? input.trackingCode : null;
  const carrierName = input.method === DeliveryMethod.CARRIER ? input.carrierName : null;
  const shipmentProofUrl =
    input.method === DeliveryMethod.CARRIER ? input.shipmentProofUrl ?? null : null;
  const deliveryProofUrl =
    input.method === DeliveryMethod.CARRIER ? input.deliveryProofUrl ?? null : null;

  return db.$transaction(async (tx) => {
    const delivery = await tx.saleDelivery.upsert({
      where: { saleId },
      update: {
        method: input.method,
        pickupRegisteredAt,
        trackingCode,
        carrierName,
        shipmentProofUrl,
        deliveryProofUrl,
      },
      create: {
        organizationId: context.organizationId,
        saleId,
        method: input.method,
        pickupRegisteredAt,
        trackingCode,
        carrierName,
        shipmentProofUrl,
        deliveryProofUrl,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_DELIVERY_SAVE",
        entityType: "SaleDelivery",
        entityId: delivery.id,
        metadata: {
          saleId,
          method: delivery.method,
          trackingCode: delivery.trackingCode,
          carrierName: delivery.carrierName,
        },
      },
    });

    return delivery;
  });
}
