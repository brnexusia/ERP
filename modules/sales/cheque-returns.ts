import { ChequeRecoveryMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { SaleNotFoundError, SaleRuleError } from "@/modules/sales/service";

const zero = () => new Prisma.Decimal(0);
const includeDetails = {
  payment: {
    include: { sale: { select: { id: true, client: { select: { id: true, name: true } } } } },
  },
  recordedBy: { select: { id: true, name: true } },
  recoveries: {
    include: { recordedBy: { select: { id: true, name: true } } },
    orderBy: { receivedAt: "asc" as const },
  },
};

export function enrichChequeReturn(row: {
  payment: { amount: Prisma.Decimal };
  recoveries: Array<{ amount: Prisma.Decimal }>;
}) {
  const recoveredAmount = row.recoveries.reduce((sum, item) => sum.add(item.amount), zero());
  const outstandingAmount = row.payment.amount.sub(recoveredAmount);
  return {
    recoveredAmount,
    outstandingAmount,
    recoveryStatus: outstandingAmount.eq(0) ? "RECOVERED" as const : "OPEN" as const,
  };
}

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      lastError = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") {
        throw error;
      }
    }
  }
  throw lastError;
}

export async function listChequeReturns(context: ClientAccessContext, saleId?: string) {
  assertPermission(context.role, "finance:read");
  if (saleId) {
    const sale = await db.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId }, select: { id: true },
    });
    if (!sale) throw new SaleNotFoundError();
  }
  const rows = await db.saleChequeReturn.findMany({
    where: {
      organizationId: context.organizationId,
      ...(saleId ? { payment: { saleId } } : {}),
    },
    include: includeDetails,
    orderBy: [{ returnedAt: "desc" }, { id: "desc" }],
  });
  return rows.map((item) => ({ ...item, ...enrichChequeReturn(item) }));
}

export async function recordReturnedCheque(
  context: ClientAccessContext,
  saleId: string,
  paymentId: string,
  input: { reason: string; returnedAt: Date },
) {
  assertPermission(context.role, "finance:write");
  if (input.returnedAt.getTime() > Date.now() + 30_000) {
    throw new SaleRuleError("A data da devolução não pode estar no futuro.");
  }
  return serializable(async (tx) => {
    const payment = await tx.salePayment.findFirst({
      where: {
        id: paymentId,
        organizationId: context.organizationId,
        saleId,
        method: "CHEQUE",
        status: "PAID",
        settledAt: { not: null },
      },
      include: { chequeReturn: { select: { id: true } } },
    });
    if (!payment) throw new SaleNotFoundError("Cheque quitado não encontrado nesta empresa.");
    if (payment.chequeReturn) throw new SaleRuleError("Este cheque já possui devolução registrada.");
    if (payment.settledAt && input.returnedAt < payment.settledAt) {
      throw new SaleRuleError("A devolução não pode anteceder a quitação do cheque.");
    }
    const created = await tx.saleChequeReturn.create({
      data: {
        organizationId: context.organizationId,
        salePaymentId: payment.id,
        returnedAt: input.returnedAt,
        reason: input.reason,
        recordedByUserId: context.userId,
      },
      include: includeDetails,
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_CHEQUE_RETURN",
        entityType: "SaleChequeReturn",
        entityId: created.id,
        metadata: {
          saleId, paymentId, returnedAt: input.returnedAt.toISOString(),
          amount: payment.amount.toFixed(2), reason: input.reason,
        },
      },
    });
    return { ...created, ...enrichChequeReturn(created) };
  });
}

export async function recordChequeRecovery(
  context: ClientAccessContext,
  saleId: string,
  paymentId: string,
  input: {
    method: ChequeRecoveryMethod; amount: string; receivedAt: Date;
    idempotencyKey: string; note?: string | null;
  },
) {
  assertPermission(context.role, "finance:write");
  if (input.receivedAt.getTime() > Date.now() + 30_000) {
    throw new SaleRuleError("A recuperação não pode ter data futura.");
  }
  const existing = await db.saleChequeRecovery.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { chequeReturn: { select: { salePaymentId: true, organizationId: true } } },
  });
  if (existing) {
    if (existing.chequeReturn.organizationId !== context.organizationId ||
        existing.chequeReturn.salePaymentId !== paymentId ||
        !existing.amount.equals(new Prisma.Decimal(input.amount)) ||
        existing.method !== input.method ||
        existing.receivedAt.getTime() !== input.receivedAt.getTime()) {
      throw new SaleRuleError("Chave de recuperação reutilizada com dados diferentes.");
    }
    return existing;
  }
  try {
    return await serializable(async (tx) => {
      const incident = await tx.saleChequeReturn.findFirst({
        where: {
          organizationId: context.organizationId,
          salePaymentId: paymentId,
          payment: { saleId },
        },
        include: { payment: { select: { amount: true } }, recoveries: true },
      });
      if (!incident) throw new SaleNotFoundError("Devolução deste cheque não encontrada.");
      if (input.receivedAt < incident.returnedAt) {
        throw new SaleRuleError("Recuperação não pode anteceder a devolução.");
      }
      const received = new Prisma.Decimal(input.amount);
      const recovered = incident.recoveries.reduce((sum, row) => sum.add(row.amount), zero());
      if (recovered.add(received).gt(incident.payment.amount)) {
        throw new SaleRuleError("A recuperação ultrapassa o valor ainda devido do cheque.");
      }
      // A write lock on the incident serializes partial collections across requests.
      await tx.saleChequeReturn.update({
        where: { id: incident.id },
        data: { updatedAt: new Date() },
      });
      const recovery = await tx.saleChequeRecovery.create({
        data: {
          organizationId: context.organizationId,
          returnId: incident.id,
          method: input.method,
          amount: received,
          receivedAt: input.receivedAt,
          idempotencyKey: input.idempotencyKey,
          note: input.note ?? null,
          recordedByUserId: context.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "SALE_CHEQUE_RECOVERY",
          entityType: "SaleChequeRecovery",
          entityId: recovery.id,
          metadata: {
            saleId, paymentId, returnId: incident.id,
            amount: received.toFixed(2), method: input.method,
            outstandingAfter: incident.payment.amount.sub(recovered).sub(received).toFixed(2),
          },
        },
      });
      return recovery;
    });
  } catch (error) {
    // A duplicated request with the same idempotency token can be safely retried.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const repeated = await db.saleChequeRecovery.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { chequeReturn: { select: { salePaymentId: true, organizationId: true } } },
      });
      if (repeated && repeated.chequeReturn.organizationId === context.organizationId &&
          repeated.chequeReturn.salePaymentId === paymentId &&
          repeated.method === input.method &&
          repeated.amount.equals(new Prisma.Decimal(input.amount)) &&
          repeated.receivedAt.getTime() === input.receivedAt.getTime()) return repeated;
    }
    throw error;
  }
}
