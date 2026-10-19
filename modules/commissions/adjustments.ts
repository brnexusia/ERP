import {
  CommissionAdjustmentDirection, Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { CommissionClosingRuleError } from "@/modules/commissions/closings";

const allowedToRead = (role: ClientAccessContext["role"]) =>
  ["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(role);
const allowedToApprove = (role: ClientAccessContext["role"]) =>
  ["OWNER", "ADMIN", "MANAGER"].includes(role);
function requireRead(ctx: ClientAccessContext) {
  if (!allowedToRead(ctx.role)) throw new PermissionDeniedError("finance:read");
}
function requireApprove(ctx: ClientAccessContext) {
  if (!allowedToApprove(ctx.role)) throw new PermissionDeniedError("organization:manage");
}
const includePeople = {
  requestedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
};
async function serializable<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await db.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      last = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
  throw last;
}
function duplicateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new CommissionClosingRuleError(
      "Já existe uma correção pendente para este fechamento. Resolva-a antes de solicitar outra.",
    );
  }
  throw error;
}
export async function listCommissionAdjustments(ctx: ClientAccessContext, closingId: string) {
  requireRead(ctx);
  const closing = await db.commissionClosing.findFirst({
    where: { id: closingId, organizationId: ctx.organizationId },
    include: {
      payable: { select: { id: true, amount: true, status: true, paidAt: true } },
    },
  });
  if (!closing) throw new CommissionClosingRuleError("Fechamento não encontrado nesta empresa.");
  const adjustments = await db.commissionAdjustment.findMany({
    where: { organizationId: ctx.organizationId, closingId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: includePeople,
  });
  return { closing, adjustments, canApprove: allowedToApprove(ctx.role) };
}
export async function requestCommissionAdjustment(
  ctx: ClientAccessContext,
  closingId: string,
  input: { direction: CommissionAdjustmentDirection; amount: string; reason: string },
) {
  requireRead(ctx);
  try {
    return await serializable(async (tx) => {
      const closing = await tx.commissionClosing.findFirst({
        where: { id: closingId, organizationId: ctx.organizationId },
        include: { payable: { include: { reconciliations: { select: { id: true } } } } },
      });
      if (!closing) throw new CommissionClosingRuleError("Fechamento não encontrado nesta empresa.");
      if (closing.payable.status !== "PENDING" || closing.payable.reconciliations.length) {
        throw new CommissionClosingRuleError(
          "Não é possível corrigir uma comissão já paga ou conciliada.",
        );
      }
      const amount = new Prisma.Decimal(input.amount);
      if (amount.lte(0)) throw new CommissionClosingRuleError("Informe um ajuste positivo.");
      if (input.direction === "DECREASE" && amount.gte(closing.payable.amount)) {
        throw new CommissionClosingRuleError(
          "A redução não pode zerar a conta. Uma anulação integral exige processo próprio.",
        );
      }
      if (await tx.commissionAdjustment.count({
        where: { closingId, organizationId: ctx.organizationId, status: "PENDING" },
      })) {
        throw new CommissionClosingRuleError(
          "Existe correção pendente para este fechamento.",
        );
      }
      const adjustment = await tx.commissionAdjustment.create({
        data: {
          organizationId: ctx.organizationId, closingId,
          direction: input.direction, amount, reason: input.reason,
          requestedByUserId: ctx.userId,
        },
        include: includePeople,
      });
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId, userId: ctx.userId,
          action: "COMMISSION_ADJUSTMENT_REQUEST",
          entityType: "CommissionAdjustment", entityId: adjustment.id,
          metadata: {
            closingId, payableId: closing.payableId,
            direction: input.direction, amount: amount.toFixed(2), reason: input.reason,
          },
        },
      });
      return adjustment;
    });
  } catch (error) { return duplicateError(error); }
}
export async function decideCommissionAdjustment(
  ctx: ClientAccessContext,
  closingId: string,
  adjustmentId: string,
  input: { decision: "APPROVE" | "REJECT"; reason?: string },
) {
  requireApprove(ctx);
  return serializable(async (tx) => {
    const closing = await tx.commissionClosing.findFirst({
      where: { id: closingId, organizationId: ctx.organizationId },
      include: {
        payable: { include: { reconciliations: { select: { id: true } } } },
      },
    });
    if (!closing) throw new CommissionClosingRuleError("Fechamento não encontrado nesta empresa.");
    const adjustment = await tx.commissionAdjustment.findFirst({
      where: {
        id: adjustmentId, closingId, organizationId: ctx.organizationId,
      },
    });
    if (!adjustment) throw new CommissionClosingRuleError("Solicitação não encontrada.");
    if (adjustment.status !== "PENDING") throw new CommissionClosingRuleError(
      "Esta correção já foi decidida.",
    );
    const approved = input.decision === "APPROVE";
    let before: Prisma.Decimal | undefined;
    let after: Prisma.Decimal | undefined;
    if (approved) {
      if (closing.payable.status !== "PENDING" || closing.payable.reconciliations.length) {
        throw new CommissionClosingRuleError(
          "Conta já paga ou conciliada. Nenhum valor histórico será reescrito.",
        );
      }
      before = closing.payable.amount;
      after = adjustment.direction === "INCREASE"
        ? before.add(adjustment.amount) : before.sub(adjustment.amount);
      if (after.lte(0) || after.gt("999999999999.99")) {
        throw new CommissionClosingRuleError("Valor resultante inválido.");
      }
      // Touches the same row locked by settleAccountPayable; concurrent settlement
      // cannot silently race an approved amount change.
      await tx.accountPayable.update({
        where: { id: closing.payableId }, data: { amount: after },
      });
    }
    const decided = await tx.commissionAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
        decidedByUserId: ctx.userId,
        decisionReason: input.reason || null,
        amountBefore: before ?? null, amountAfter: after ?? null,
      },
      include: includePeople,
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: approved ? "COMMISSION_ADJUSTMENT_APPROVE" : "COMMISSION_ADJUSTMENT_REJECT",
        entityType: "CommissionAdjustment", entityId: decided.id,
        metadata: {
          closingId, payableId: closing.payableId,
          requestedByUserId: adjustment.requestedByUserId,
          direction: adjustment.direction, amount: adjustment.amount.toFixed(2),
          amountBefore: before?.toFixed(2) ?? null,
          amountAfter: after?.toFixed(2) ?? null,
          reason: input.reason || null,
        },
      },
    });
    return decided;
  });
}
