import { ManualReceiptMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import {
  FinanceNotFoundError,
  FinanceRuleError,
  type FinanceAccessContext,
} from "@/modules/finance/service";

const zero = () => new Prisma.Decimal(0);
const includeDetails = {
  client: { select: { id: true, name: true, document: true } },
  createdBy: { select: { id: true, name: true } },
  receipts: {
    include: { recordedBy: { select: { id: true, name: true } } },
    orderBy: [{ receivedAt: "asc" as const }, { id: "asc" as const }],
  },
};

export function summarizeManualReceivable(row: {
  amount: Prisma.Decimal;
  dueDate: Date;
  receipts: Array<{ amount: Prisma.Decimal }>;
}, now = new Date()) {
  const receivedAmount = row.receipts.reduce((sum, receipt) => sum.add(receipt.amount), zero());
  const outstandingAmount = row.amount.sub(receivedAmount);
  return {
    receivedAmount,
    outstandingAmount,
    status: outstandingAmount.eq(0) ? "PAID" as const :
      receivedAmount.gt(0) ? "PARTIAL" as const : "OPEN" as const,
    overdue: outstandingAmount.gt(0) && row.dueDate < now,
  };
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
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
  throw last;
}

export async function listManualReceivables(context: FinanceAccessContext, clientId?: string) {
  assertPermission(context.role, "finance:read");
  if (clientId) {
    const client = await db.client.findFirst({
      where: { id: clientId, organizationId: context.organizationId }, select: { id: true },
    });
    if (!client) throw new FinanceNotFoundError("Cliente não encontrado nesta empresa.");
  }
  const rows = await db.clientManualReceivable.findMany({
    where: {
      organizationId: context.organizationId,
      ...(clientId ? { clientId } : {}),
    },
    include: includeDetails,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((item) => ({ ...item, ...summarizeManualReceivable(item) }));
}

export async function createManualReceivable(
  context: FinanceAccessContext,
  input: {
    clientId: string;
    sourceReference: string;
    description: string;
    amount: string;
    dueDate: Date;
  },
) {
  assertPermission(context.role, "finance:write");
  const client = await db.client.findFirst({
    where: { id: input.clientId, organizationId: context.organizationId },
    select: { id: true },
  });
  if (!client) throw new FinanceNotFoundError("Cliente não encontrado nesta empresa.");
  const amount = new Prisma.Decimal(input.amount);
  try {
    return await db.$transaction(async (tx) => {
      const item = await tx.clientManualReceivable.create({
        data: {
          organizationId: context.organizationId,
          clientId: client.id,
          sourceReference: input.sourceReference,
          description: input.description,
          amount,
          dueDate: input.dueDate,
          createdByUserId: context.userId,
        },
        include: includeDetails,
      });
      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "MANUAL_RECEIVABLE_CREATE",
          entityType: "ClientManualReceivable",
          entityId: item.id,
          metadata: {
            clientId: client.id,
            sourceReference: input.sourceReference,
            amount: amount.toFixed(2),
            dueDate: input.dueDate.toISOString(),
            description: input.description,
          },
        },
      });
      return { ...item, ...summarizeManualReceivable(item) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinanceRuleError("Referência já utilizada nesta empresa. Confira antes de criar outra cobrança.");
    }
    throw error;
  }
}

export async function receiveManualReceivable(
  context: FinanceAccessContext,
  id: string,
  input: {
    amount: string;
    method: ManualReceiptMethod;
    receivedAt: Date;
    idempotencyKey: string;
    note?: string | null;
  },
) {
  assertPermission(context.role, "finance:write");
  if (input.receivedAt.getTime() > Date.now() + 30_000) {
    throw new FinanceRuleError("A data do recebimento não pode estar no futuro.");
  }
  const samePayload = (row: {
    receivableId: string; organizationId: string; amount: Prisma.Decimal;
    method: ManualReceiptMethod; receivedAt: Date; note: string | null;
  }) =>
    row.organizationId === context.organizationId &&
    row.receivableId === id &&
    row.amount.eq(input.amount) &&
    row.method === input.method &&
    row.receivedAt.getTime() === input.receivedAt.getTime() &&
    (row.note ?? null) === (input.note ?? null);

  const prior = await db.clientManualReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) {
    if (!samePayload(prior)) throw new FinanceRuleError("Chave de recebimento reutilizada com dados diferentes.");
    return prior;
  }

  try {
    return await serializable(async (tx) => {
      const account = await tx.clientManualReceivable.findFirst({
        where: { id, organizationId: context.organizationId },
        include: { receipts: { select: { amount: true } } },
      });
      if (!account) throw new FinanceNotFoundError("Cobrança não encontrada nesta empresa.");
      const received = account.receipts.reduce((sum, row) => sum.add(row.amount), zero());
      const paymentAmount = new Prisma.Decimal(input.amount);
      if (received.add(paymentAmount).gt(account.amount)) {
        throw new FinanceRuleError("Recebimento ultrapassa o saldo devido desta cobrança.");
      }
      const receipt = await tx.clientManualReceipt.create({
        data: {
          organizationId: context.organizationId,
          receivableId: account.id,
          amount: paymentAmount,
          method: input.method,
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
          action: "MANUAL_RECEIPT_CREATE",
          entityType: "ClientManualReceipt",
          entityId: receipt.id,
          metadata: {
            receivableId: account.id, clientId: account.clientId,
            amount: paymentAmount.toFixed(2), method: input.method,
            outstandingAfter: account.amount.sub(received).sub(paymentAmount).toFixed(2),
          },
        },
      });
      return receipt;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const repeat = await db.clientManualReceipt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (repeat && samePayload(repeat)) return repeat;
      throw new FinanceRuleError("Chave de recebimento duplicada; confira a baixa original.");
    }
    throw error;
  }
}
