import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission, PermissionDeniedError } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { SaleNotFoundError, SaleRuleError } from "@/modules/sales/service";

const MANAGERS = ["OWNER", "ADMIN", "MANAGER"] as const;

export function canApproveDiscount(role: ClientAccessContext["role"]) {
  return MANAGERS.some((manager) => manager === role);
}

function requireManager(context: ClientAccessContext) {
  if (!canApproveDiscount(context.role)) {
    throw new PermissionDeniedError("organization:manage");
  }
}

function includePeople() {
  return {
    requestedBy: { select: { id: true, name: true } },
    decidedBy: { select: { id: true, name: true } },
  };
}

export async function listSaleDiscounts(context: ClientAccessContext, saleId: string) {
  assertPermission(context.role, "sales:read");
  const sale = await db.sale.findFirst({
    where: { id: saleId, organizationId: context.organizationId },
    select: { id: true, stage: true, totalAmount: true, discountAmount: true },
  });
  if (!sale) throw new SaleNotFoundError();
  const requests = await db.saleDiscountRequest.findMany({
    where: { saleId, organizationId: context.organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: includePeople(),
  });
  return { sale, requests, canApprove: canApproveDiscount(context.role) };
}

async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      last = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new SaleRuleError("Este pedido já possui um desconto pendente ou aprovado.");
        }
        throw error;
      }
    }
  }
  throw last;
}

export async function requestSaleDiscount(
  context: ClientAccessContext,
  saleId: string,
  input: { percent: string; reason: string },
) {
  assertPermission(context.role, "sales:write");
  return serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
      select: { id: true, stage: true, totalAmount: true, discountAmount: true },
    });
    if (!sale) throw new SaleNotFoundError();
    if (sale.stage !== "QUOTE") throw new SaleRuleError("Descontos só podem ser solicitados no orçamento.");
    if (sale.discountAmount.gt(0)) throw new SaleRuleError("O orçamento já possui desconto aprovado.");
    const pending = await tx.saleDiscountRequest.findFirst({
      where: { saleId, organizationId: context.organizationId, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (pending) throw new SaleRuleError("Há desconto pendente ou aprovado neste orçamento.");
    const percent = new Prisma.Decimal(input.percent);
    if (percent.lte(0) || percent.gte(100)) throw new SaleRuleError("Percentual precisa estar entre 0 e 100, sem os extremos.");
    const discountAmount = sale.totalAmount.mul(percent).div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (discountAmount.lte(0) || discountAmount.gte(sale.totalAmount)) {
      throw new SaleRuleError("O desconto deve reduzir o total sem zerar o orçamento.");
    }
    // Touch the sale row: serializes the request with edit/confirmation.
    await tx.sale.update({ where: { id: sale.id }, data: { updatedAt: new Date() } });
    const request = await tx.saleDiscountRequest.create({
      data: {
        organizationId: context.organizationId, saleId, percent,
        baseAmount: sale.totalAmount, discountAmount,
        reason: input.reason, requestedByUserId: context.userId,
      },
      include: includePeople(),
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId, userId: context.userId,
        action: "SALE_DISCOUNT_REQUEST", entityType: "SaleDiscountRequest", entityId: request.id,
        metadata: { saleId, percent: percent.toFixed(2), baseAmount: sale.totalAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2) },
      },
    });
    return request;
  });
}

export async function decideSaleDiscount(
  context: ClientAccessContext,
  saleId: string,
  requestId: string,
  input: { decision: "APPROVE" | "REJECT"; reason?: string },
) {
  requireManager(context);
  return serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
      select: { id: true, stage: true, totalAmount: true, discountAmount: true },
    });
    if (!sale) throw new SaleNotFoundError();
    if (sale.stage !== "QUOTE") throw new SaleRuleError("Não é possível decidir desconto depois do pedido confirmado.");
    const request = await tx.saleDiscountRequest.findFirst({
      where: { id: requestId, saleId, organizationId: context.organizationId },
    });
    if (!request) throw new SaleNotFoundError("Solicitação de desconto não encontrada.");
    if (request.status !== "PENDING") throw new SaleRuleError("Esta solicitação já foi decidida.");
    if (!sale.totalAmount.equals(request.baseAmount) || sale.discountAmount.gt(0)) {
      throw new SaleRuleError("O orçamento mudou; reavalie o desconto sobre o valor atualizado.");
    }
    const approved = input.decision === "APPROVE";
    if (approved) {
      const net = sale.totalAmount.sub(request.discountAmount);
      if (net.lte(0)) throw new SaleRuleError("Desconto inválido para o total do orçamento.");
      await tx.sale.update({
        where: { id: saleId },
        data: { totalAmount: net, discountAmount: request.discountAmount },
      });
    } else {
      await tx.sale.update({ where: { id: saleId }, data: { updatedAt: new Date() } });
    }
    const updated = await tx.saleDiscountRequest.update({
      where: { id: request.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        decisionReason: input.reason ?? null,
        decidedAt: new Date(),
        decidedByUserId: context.userId,
      },
      include: includePeople(),
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId, userId: context.userId,
        action: approved ? "SALE_DISCOUNT_APPROVE" : "SALE_DISCOUNT_REJECT",
        entityType: "SaleDiscountRequest", entityId: request.id,
        metadata: {
          saleId, percent: request.percent.toFixed(2),
          discountAmount: request.discountAmount.toFixed(2),
          reason: input.reason ?? null,
        },
      },
    });
    return updated;
  });
}
