import { Prisma, SaleStage } from "@prisma/client";
import { db } from "@/lib/db";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";

function requireFinanceManager(context: ClientAccessContext) {
  if (!["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(context.role)) {
    throw new PermissionDeniedError("finance:read");
  }
}

export class CommissionInputError extends Error {
  constructor(message: string) { super(message); this.name = "CommissionInputError"; }
}

export function parseCommissionMonth(month: string) {
  const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new CommissionInputError("Mês inválido. Use AAAA-MM.");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  // São Paulo commercial months (UTC-03 in 2026). Timezone by tenant is a
  // separate configurable enhancement, never silently use the VPS timezone.
  return {
    from: new Date(Date.UTC(year, monthIndex, 1, 3)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1, 3)),
    sellerDueDate: new Date(Date.UTC(year, monthIndex + 1, 15, 3)),
  };
}

export async function updateSellerCommission(
  context: ClientAccessContext,
  membershipId: string,
  percent: string | null,
) {
  if (!["OWNER", "ADMIN", "MANAGER"].includes(context.role)) {
    throw new PermissionDeniedError("organization:manage");
  }
  return db.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId, organizationId: context.organizationId,
        role: "SELLER", user: { status: "ACTIVE" },
      },
      include: { user: { select: { name: true } } },
    });
    if (!membership) return null;
    const updated = await tx.membership.update({
      where: { id: membershipId },
      data: { commissionPercent: percent === null ? null : new Prisma.Decimal(percent) },
      include: { user: { select: { name: true } } },
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SELLER_COMMISSION_RATE_UPDATE",
        entityType: "Membership",
        entityId: membershipId,
        metadata: {
          before: membership.commissionPercent?.toFixed(2) ?? null,
          after: updated.commissionPercent?.toFixed(2) ?? null,
        },
      },
    });
    return updated;
  });
}

export async function getCommissionPreview(context: ClientAccessContext, month: string) {
  requireFinanceManager(context);
  const period = parseCommissionMonth(month);
  const [sellerSales, representativeSales] = await Promise.all([
    db.sale.findMany({
      where: {
        organizationId: context.organizationId,
        stage: { in: [SaleStage.ORDER, SaleStage.PAID] },
        orderedAt: { gte: period.from, lt: period.to },
      },
      include: {
        seller: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ orderedAt: "asc" }, { id: "asc" }],
    }),
    db.sale.findMany({
      where: {
        organizationId: context.organizationId,
        stage: { in: [SaleStage.ORDER, SaleStage.PAID] },
        representativeId: { not: null },
        representativeRate: { not: null },
        payments: { some: { dueDate: { gte: period.from, lt: period.to } } },
      },
      include: {
        representative: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        payments: {
          where: { dueDate: { gte: period.from, lt: period.to },
            method: { in: ["BOLETO", "CHEQUE", "VALE"] } },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
  ]);

  type SellerGroup = {
    sellerMembershipId: string;
    sellerName: string;
    grossSold: Prisma.Decimal;
    commission: Prisma.Decimal;
    sales: Array<{
      saleId: string; orderedAt: Date | null; amount: Prisma.Decimal;
      rate: Prisma.Decimal | null; commission: Prisma.Decimal;
    }>;
  };
  const sellers = new Map<string, SellerGroup>();
  const zero = () => new Prisma.Decimal(0);

  for (const sale of sellerSales) {
    const group = sellers.get(sale.sellerMembershipId) ?? {
      sellerMembershipId: sale.sellerMembershipId,
      sellerName: sale.seller.user.name,
      grossSold: zero(), commission: zero(), sales: [],
    };
    const commission = sale.sellerCommissionRate
      ? sale.totalAmount.mul(sale.sellerCommissionRate).div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : zero();
    group.grossSold = group.grossSold.add(sale.totalAmount);
    group.commission = group.commission.add(commission);
    group.sales.push({
      saleId: sale.id, orderedAt: sale.orderedAt, amount: sale.totalAmount,
      rate: sale.sellerCommissionRate, commission,
    });
    sellers.set(sale.sellerMembershipId, group);
  }

  type RepLine = {
    saleId: string; paymentId: string; clientId: string; clientName: string;
    dueDate: Date | null; method: string; paymentAmount: Prisma.Decimal;
    status: string; rate: Prisma.Decimal; commission: Prisma.Decimal;
  };
  type RepGroup = {
    representativeId: string; representativeName: string;
    commission: Prisma.Decimal; payments: RepLine[];
  };
  const representatives = new Map<string, RepGroup>();
  for (const sale of representativeSales) {
    if (!sale.representative || !sale.representativeRate) continue;
    const group = representatives.get(sale.representative.id) ?? {
      representativeId: sale.representative.id,
      representativeName: sale.representative.name,
      commission: zero(),
      payments: [],
    };
    for (const payment of sale.payments) {
      const commission = payment.amount.mul(sale.representativeRate).div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      group.commission = group.commission.add(commission);
      group.payments.push({
        saleId: sale.id, paymentId: payment.id, clientId: sale.client.id,
        clientName: sale.client.name, dueDate: payment.dueDate,
        method: payment.method, status: payment.status,
        paymentAmount: payment.amount, rate: sale.representativeRate, commission,
      });
    }
    representatives.set(group.representativeId, group);
  }

  const sellerRows = [...sellers.values()].sort((a, b) =>
    a.sellerName.localeCompare(b.sellerName));
  const representativeRows = [...representatives.values()].sort((a, b) =>
    a.representativeName.localeCompare(b.representativeName));
  return {
    period: { month, from: period.from, to: period.to,
      sellerDueDate: period.sellerDueDate, timeZone: "America/Sao_Paulo" },
    sellers: sellerRows,
    representatives: representativeRows,
    totals: {
      seller: sellerRows.reduce((sum, row) => sum.add(row.commission), zero()),
      representative: representativeRows.reduce((sum, row) => sum.add(row.commission), zero()),
    },
    provisional: true,
    note: "Prévia para conferência; não gera contas a pagar ou baixas de comissão.",
  };
}
