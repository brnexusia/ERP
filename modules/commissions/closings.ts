import { CommissionRecipientKind, Prisma, SaleStage } from "@prisma/client";
import { db } from "@/lib/db";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { CommissionInputError, parseCommissionMonth } from "@/modules/commissions/service";

export class CommissionClosingRuleError extends Error {
  constructor(message: string) { super(message); this.name = "CommissionClosingRuleError"; }
}
function readAllowed(context: ClientAccessContext) {
  if (!["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(context.role)) {
    throw new PermissionDeniedError("finance:read");
  }
}
function approveAllowed(context: ClientAccessContext) {
  if (!["OWNER", "ADMIN", "MANAGER"].includes(context.role)) {
    throw new PermissionDeniedError("organization:manage");
  }
}
const zero = () => new Prisma.Decimal(0);
const money = (value: Prisma.Decimal) =>
  value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const detail = { payable: { select: { id: true, status: true, paidAt: true, dueDate: true } },
  approvedBy: { select: { name: true } } };

export async function listCommissionClosings(context: ClientAccessContext, month: string) {
  readAllowed(context);
  parseCommissionMonth(month);
  return db.commissionClosing.findMany({
    where: { organizationId: context.organizationId, month },
    include: detail,
    orderBy: [{ kind: "asc" }, { beneficiaryName: "asc" }, { approvedAt: "asc" }],
  });
}
async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      last = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") {
        throw error;
      }
    }
  }
  throw last;
}
export async function closeCommission(
  context: ClientAccessContext,
  input: { month: string; kind: CommissionRecipientKind; sourceId: string },
) {
  approveAllowed(context);
  const period = parseCommissionMonth(input.month);
  if (period.to > new Date()) {
    throw new CommissionClosingRuleError(
      "A competência ainda está em aberto. Feche somente meses já encerrados.",
    );
  }
  try {
    return await serializable(async (tx) => {
      const existing = await tx.commissionClosing.findFirst({
        where: {
          organizationId: context.organizationId, month: input.month,
          kind: input.kind, sourceId: input.sourceId,
        },
        include: detail,
      });
      if (existing) throw new CommissionClosingRuleError(
        "Esta comissão já foi fechada; confira a conta a pagar existente.",
      );
      let beneficiaryId = "";
      let beneficiaryName = "";
      let payableDueDate = period.sellerDueDate;
      let amount = zero();
      let snapshot: Prisma.InputJsonObject;

      if (input.kind === "SELLER") {
        const membership = await tx.membership.findFirst({
          where: {
            id: input.sourceId,
            organizationId: context.organizationId,
            role: "SELLER",
          },
          select: { id: true, user: { select: { id: true, name: true } } },
        });
        if (!membership) throw new CommissionClosingRuleError("Vendedora não encontrada.");
        beneficiaryId = membership.id;
        beneficiaryName = membership.user.name;
        const sales = await tx.sale.findMany({
          where: {
            organizationId: context.organizationId,
            sellerMembershipId: membership.id,
            stage: { in: [SaleStage.ORDER, SaleStage.PAID] },
            orderedAt: { gte: period.from, lt: period.to },
          },
          orderBy: [{ orderedAt: "asc" }, { id: "asc" }],
          select: {
            id: true, orderedAt: true, totalAmount: true, sellerCommissionRate: true,
          },
        });
        const lines = sales.map((sale) => {
          const commission = sale.sellerCommissionRate
            ? money(sale.totalAmount.mul(sale.sellerCommissionRate).div(100))
            : zero();
          amount = amount.add(commission);
          return {
            saleId: sale.id,
            orderedAt: sale.orderedAt?.toISOString() ?? null,
            amount: sale.totalAmount.toFixed(2),
            rate: sale.sellerCommissionRate?.toFixed(2) ?? null,
            commission: commission.toFixed(2),
          };
        });
        snapshot = { calculation: "CONFIRMED_SALES", sales: lines,
          sellerMembershipId: membership.id };
      } else if (input.kind === "REPRESENTATIVE") {
        // One payable per installment: each representative commission retains the
        // installment's actual due date, never an invented monthly due date.
        const payment = await tx.salePayment.findFirst({
          where: {
            id: input.sourceId,
            organizationId: context.organizationId,
            method: { in: ["BOLETO", "CHEQUE", "VALE"] },
            dueDate: { gte: period.from, lt: period.to },
            sale: {
              organizationId: context.organizationId,
              stage: { in: [SaleStage.ORDER, SaleStage.PAID] },
              representativeId: { not: null },
              representativeRate: { not: null },
            },
          },
          include: {
            sale: {
              include: { representative: { select: { id: true, name: true } } },
            },
          },
        });
        if (!payment || !payment.sale.representative ||
          !payment.sale.representativeRate || !payment.dueDate) {
          throw new CommissionClosingRuleError("Parcela de representante não encontrada nesta competência.");
        }
        beneficiaryId = payment.sale.representative.id;
        beneficiaryName = payment.sale.representative.name;
        payableDueDate = payment.dueDate;
        amount = money(payment.amount.mul(payment.sale.representativeRate).div(100));
        snapshot = {
          calculation: "INSTALLMENT_DUE_DATE",
          saleId: payment.saleId,
          paymentId: payment.id,
          method: payment.method,
          paymentStatusAtApproval: payment.status,
          paymentAmount: payment.amount.toFixed(2),
          rate: payment.sale.representativeRate.toFixed(2),
          commission: amount.toFixed(2),
          dueDate: payment.dueDate.toISOString(),
        };
      } else {
        throw new CommissionInputError("Tipo de comissão inválido.");
      }
      if (amount.lte(0)) {
        throw new CommissionClosingRuleError(
          "Não há valor positivo de comissão para fechar neste registro.",
        );
      }
      const description = input.kind === "SELLER"
        ? `Comissão vendedora - ${beneficiaryName} - ${input.month}`
        : `Comissão representante - ${beneficiaryName} - parcela ${input.sourceId}`;
      const payable = await tx.accountPayable.create({
        data: {
          organizationId: context.organizationId,
          description,
          amount,
          dueDate: payableDueDate,
        },
      });
      const closing = await tx.commissionClosing.create({
        data: {
          organizationId: context.organizationId,
          month: input.month,
          kind: input.kind,
          sourceId: input.sourceId,
          beneficiaryId, beneficiaryName, amount,
          dueDate: payableDueDate,
          payableId: payable.id,
          approvedByUserId: context.userId,
          snapshot,
        },
        include: detail,
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "COMMISSION_CLOSING_APPROVE",
          entityType: "CommissionClosing",
          entityId: closing.id,
          metadata: {
            kind: input.kind, month: input.month, sourceId: input.sourceId,
            beneficiaryId, payableId: payable.id,
            amount: amount.toFixed(2), dueDate: payableDueDate.toISOString(),
          },
        },
      });
      return closing;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CommissionClosingRuleError(
        "Comissão já fechada. Não é possível criar uma segunda conta a pagar.",
      );
    }
    throw error;
  }
}
