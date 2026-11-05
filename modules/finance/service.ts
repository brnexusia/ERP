import { Prisma, type MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type {
  AccountPayableCreateInput,
  BankReconciliationCreateInput,
  BankStatementEntryCreateInput,
  FinancePeriodInput,
} from "@/modules/finance/schema";

export type FinanceAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class FinanceNotFoundError extends Error {
  constructor(message = "Registro financeiro não encontrado.") {
    super(message);
    this.name = "FinanceNotFoundError";
  }
}

export class FinanceRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceRuleError";
  }
}

function decimalSum(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
}

function nullableDateRange(period: FinancePeriodInput): Prisma.DateTimeNullableFilter | undefined {
  if (!period.from && !period.to) return undefined;
  return {
    not: null,
    ...(period.from ? { gte: period.from } : {}),
    ...(period.to ? { lte: period.to } : {}),
  };
}

async function runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") {
        throw error;
      }
    }
  }
  throw lastError;
}

export async function listAccountsReceivable(context: FinanceAccessContext) {
  assertPermission(context.role, "finance:read");
  const now = new Date();

  const payments = await db.salePayment.findMany({
    where: { organizationId: context.organizationId },
    include: {
      sale: {
        include: {
          client: true,
          seller: { select: { id: true, userId: true, role: true, user: { select: { id: true, name: true } } } },
        },
      },
      reconciliations: true,
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });

  return payments.map((payment) => ({
    ...payment,
    overdue: payment.status === "PENDING" && Boolean(payment.dueDate && payment.dueDate < now),
    reconciledAmount: decimalSum(payment.reconciliations.map((item) => item.amount)),
  }));
}

export async function listAccountsPayable(context: FinanceAccessContext) {
  assertPermission(context.role, "finance:read");
  const now = new Date();

  const payables = await db.accountPayable.findMany({
    where: { organizationId: context.organizationId },
    include: { reconciliations: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });

  return payables.map((payable) => ({
    ...payable,
    overdue: payable.status === "PENDING" && payable.dueDate < now,
    reconciledAmount: decimalSum(payable.reconciliations.map((item) => item.amount)),
  }));
}

export async function createAccountPayable(
  context: FinanceAccessContext,
  input: AccountPayableCreateInput,
) {
  assertPermission(context.role, "finance:write");

  return db.$transaction(async (tx) => {
    const payable = await tx.accountPayable.create({
      data: {
        organizationId: context.organizationId,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        dueDate: input.dueDate,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "ACCOUNT_PAYABLE_CREATE",
        entityType: "AccountPayable",
        entityId: payable.id,
        metadata: { amount: input.amount, dueDate: input.dueDate.toISOString() },
      },
    });

    return payable;
  });
}

export async function settleAccountPayable(context: FinanceAccessContext, payableId: string) {
  assertPermission(context.role, "finance:write");

  return runSerializable(async (tx) => {
    const payable = await tx.accountPayable.findFirst({
      where: { id: payableId, organizationId: context.organizationId },
      include: { commissionClosing: {
        select: { adjustments: {
          where: { status: "PENDING" },
          select: { id: true },
        } },
      } },
    });
    if (!payable) throw new FinanceNotFoundError("Conta a pagar não encontrada.");
    if (payable.status === "PAID") return payable;
    if (payable.commissionClosing?.adjustments.length) {
      throw new FinanceRuleError(
        "A comissão possui correção pendente. Aguarde aprovação ou recusa antes de registrar pagamento.",
      );
    }

    const paidAt = new Date();
    const updated = await tx.accountPayable.update({
      where: { id: payable.id },
      data: { status: "PAID", paidAt },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "ACCOUNT_PAYABLE_SETTLE",
        entityType: "AccountPayable",
        entityId: payable.id,
        metadata: { paidAt: paidAt.toISOString() },
      },
    });

    return updated;
  });
}

export async function listBankStatementEntries(context: FinanceAccessContext) {
  assertPermission(context.role, "finance:read");

  const entries = await db.bankStatementEntry.findMany({
    where: { organizationId: context.organizationId },
    include: {
      reconciliations: {
        include: {
          salePayment: { include: { sale: { include: { client: true } } } },
          accountPayable: true,
        },
        orderBy: { reconciledAt: "asc" },
      },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });

  return entries.map((entry) => {
    const reconciledAmount = decimalSum(entry.reconciliations.map((item) => item.amount));
    return {
      ...entry,
      reconciledAmount,
      remainingAmount: entry.amount.minus(reconciledAmount),
      fullyReconciled: reconciledAmount.equals(entry.amount),
    };
  });
}

export async function createBankStatementEntry(
  context: FinanceAccessContext,
  input: BankStatementEntryCreateInput,
) {
  assertPermission(context.role, "finance:write");

  return db.$transaction(async (tx) => {
    const entry = await tx.bankStatementEntry.create({
      data: {
        organizationId: context.organizationId,
        direction: input.direction,
        amount: new Prisma.Decimal(input.amount),
        occurredAt: input.occurredAt,
        description: input.description,
        reference: input.reference ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "BANK_ENTRY_CREATE",
        entityType: "BankStatementEntry",
        entityId: entry.id,
        metadata: { direction: input.direction, amount: input.amount },
      },
    });

    return entry;
  });
}

export async function reconcileBankStatementEntry(
  context: FinanceAccessContext,
  bankEntryId: string,
  input: BankReconciliationCreateInput,
) {
  assertPermission(context.role, "finance:write");
  const amount = new Prisma.Decimal(input.amount);

  return runSerializable(async (tx) => {
    const bankEntry = await tx.bankStatementEntry.findFirst({
      where: { id: bankEntryId, organizationId: context.organizationId },
    });
    if (!bankEntry) throw new FinanceNotFoundError("Lançamento bancário não encontrado.");

    const bankAggregate = await tx.bankReconciliation.aggregate({
      where: { organizationId: context.organizationId, bankEntryId: bankEntry.id },
      _sum: { amount: true },
    });
    const bankAlreadyReconciled = bankAggregate._sum.amount ?? new Prisma.Decimal(0);
    if (bankAlreadyReconciled.plus(amount).greaterThan(bankEntry.amount)) {
      throw new FinanceRuleError("A conciliação ultrapassa o valor do lançamento bancário.");
    }

    let salePaymentId: string | null = null;
    let accountPayableId: string | null = null;

    if (input.salePaymentId) {
      if (bankEntry.direction !== "CREDIT") {
        throw new FinanceRuleError("Recebimentos só podem ser conciliados com lançamentos bancários de crédito.");
      }
      const payment = await tx.salePayment.findFirst({
        where: {
          id: input.salePaymentId,
          organizationId: context.organizationId,
          status: "PAID",
          method: { not: "VALE" },
          chequeReturn: { is: null },
          settledAt: { not: null },
        },
      });
      if (!payment) throw new FinanceNotFoundError("Pagamento recebido não encontrado.");

      const sourceAggregate = await tx.bankReconciliation.aggregate({
        where: { organizationId: context.organizationId, salePaymentId: payment.id },
        _sum: { amount: true },
      });
      const sourceAlreadyReconciled = sourceAggregate._sum.amount ?? new Prisma.Decimal(0);
      if (sourceAlreadyReconciled.plus(amount).greaterThan(payment.amount)) {
        throw new FinanceRuleError("A conciliação ultrapassa o valor do recebimento.");
      }
      salePaymentId = payment.id;
    }

    if (input.accountPayableId) {
      if (bankEntry.direction !== "DEBIT") {
        throw new FinanceRuleError("Pagamentos só podem ser conciliados com lançamentos bancários de débito.");
      }
      const payable = await tx.accountPayable.findFirst({
        where: {
          id: input.accountPayableId,
          organizationId: context.organizationId,
          status: "PAID",
          paidAt: { not: null },
        },
      });
      if (!payable) throw new FinanceNotFoundError("Conta paga não encontrada.");

      const sourceAggregate = await tx.bankReconciliation.aggregate({
        where: { organizationId: context.organizationId, accountPayableId: payable.id },
        _sum: { amount: true },
      });
      const sourceAlreadyReconciled = sourceAggregate._sum.amount ?? new Prisma.Decimal(0);
      if (sourceAlreadyReconciled.plus(amount).greaterThan(payable.amount)) {
        throw new FinanceRuleError("A conciliação ultrapassa o valor da conta paga.");
      }
      accountPayableId = payable.id;
    }

    const reconciliation = await tx.bankReconciliation.create({
      data: {
        organizationId: context.organizationId,
        bankEntryId: bankEntry.id,
        salePaymentId,
        accountPayableId,
        amount,
        note: input.note ?? null,
      },
      include: {
        salePayment: { include: { sale: { include: { client: true } } } },
        accountPayable: true,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "BANK_RECONCILE",
        entityType: "BankReconciliation",
        entityId: reconciliation.id,
        metadata: {
          bankEntryId: bankEntry.id,
          salePaymentId,
          accountPayableId,
          amount: input.amount,
        },
      },
    });

    return reconciliation;
  });
}

export async function getCashFlow(context: FinanceAccessContext, period: FinancePeriodInput) {
  assertPermission(context.role, "finance:read");
  const settledAt = nullableDateRange(period);
  const paidAt = nullableDateRange(period);

  const [receipts, payments, returnedCheques, recoveries, manualReceipts] = await Promise.all([
    db.salePayment.findMany({
      where: {
        organizationId: context.organizationId,
        status: "PAID",
        method: { not: "VALE" },
        settledAt: settledAt ?? { not: null },
      },
      include: { sale: { include: { client: true } } },
      orderBy: { settledAt: "asc" },
    }),
    db.accountPayable.findMany({
      where: {
        organizationId: context.organizationId,
        status: "PAID",
        paidAt: paidAt ?? { not: null },
      },
      orderBy: { paidAt: "asc" },
    }),
    db.saleChequeReturn.findMany({
      where: {
        organizationId: context.organizationId,
        ...((period.from || period.to) ? { returnedAt: {
          ...(period.from ? { gte: period.from } : {}),
          ...(period.to ? { lte: period.to } : {}),
        } } : {}),
      },
      include: { payment: { select: { amount: true, sale: { select: { client: { select: { name: true } } } } } } },
      orderBy: { returnedAt: "asc" },
    }),
    db.saleChequeRecovery.findMany({
      where: {
        organizationId: context.organizationId,
        ...((period.from || period.to) ? { receivedAt: {
          ...(period.from ? { gte: period.from } : {}),
          ...(period.to ? { lte: period.to } : {}),
        } } : {}),
      },
      include: { chequeReturn: { select: {
        payment: { select: { sale: { select: { client: { select: { name: true } } } } } },
      } } },
      orderBy: { receivedAt: "asc" },
    }),
    db.clientManualReceipt.findMany({
      where: {
        organizationId: context.organizationId,
        ...((period.from || period.to) ? { receivedAt: {
          ...(period.from ? { gte: period.from } : {}),
          ...(period.to ? { lte: period.to } : {}),
        } } : {}),
      },
      include: { receivable: { select: {
        client: { select: { name: true } }, description: true,
      } } },
      orderBy: { receivedAt: "asc" },
    }),
  ]);

  const inflow = decimalSum([...receipts.map((item) => item.amount),
    ...recoveries.map((item) => item.amount), ...manualReceipts.map((item) => item.amount)]);
  const outflow = decimalSum([...payments.map((item) => item.amount), ...returnedCheques.map((item) => item.payment.amount)]);
  const entries = [
    ...receipts.map((item) => ({
      direction: "INFLOW" as const,
      source: "SALE_PAYMENT" as const,
      sourceId: item.id,
      occurredAt: item.settledAt,
      amount: item.amount,
      description: `Recebimento - ${item.sale.client.name}`,
    })),
    ...payments.map((item) => ({
      direction: "OUTFLOW" as const,
      source: "ACCOUNT_PAYABLE" as const,
      sourceId: item.id,
      occurredAt: item.paidAt,
      amount: item.amount,
      description: item.description,
    })),
    ...returnedCheques.map((item) => ({
      direction: "OUTFLOW" as const,
      source: "CHEQUE_RETURN" as const,
      sourceId: item.id,
      occurredAt: item.returnedAt,
      amount: item.payment.amount,
      description: `Estorno contábil de cheque devolvido - ${item.payment.sale.client.name}`,
    })),
    ...recoveries.map((item) => ({
      direction: "INFLOW" as const,
      source: "CHEQUE_RECOVERY" as const,
      sourceId: item.id,
      occurredAt: item.receivedAt,
      amount: item.amount,
      description: `Recuperação de cheque devolvido - ${item.chequeReturn.payment.sale.client.name}`,
    })),
    ...manualReceipts.map((item) => ({
      direction: "INFLOW" as const,
      source: "MANUAL_RECEIPT" as const,
      sourceId: item.id,
      occurredAt: item.receivedAt,
      amount: item.amount,
      description: `Cobrança avulsa - ${item.receivable.client.name} - ${item.receivable.description}`,
    })),
  ].sort((a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0));

  return {
    period,
    totals: {
      inflow,
      outflow,
      net: inflow.minus(outflow),
    },
    entries,
  };
}

export async function getFinancialReport(context: FinanceAccessContext, period: FinancePeriodInput) {
  assertPermission(context.role, "finance:read");
  const now = new Date();
  const settledAt = nullableDateRange(period);
  const paidAt = nullableDateRange(period);

  const [
    receivableOpen,
    receivableOverdue,
    payableOpen,
    payableOverdue,
    realizedReceipts,
    realizedPayments,
    bankEntries,
    reconciliations,
  ] = await Promise.all([
    db.salePayment.aggregate({
      where: { organizationId: context.organizationId, status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.salePayment.aggregate({
      where: {
        organizationId: context.organizationId,
        status: "PENDING",
        dueDate: { lt: now },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.accountPayable.aggregate({
      where: { organizationId: context.organizationId, status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.accountPayable.aggregate({
      where: {
        organizationId: context.organizationId,
        status: "PENDING",
        dueDate: { lt: now },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.salePayment.aggregate({
      where: {
        organizationId: context.organizationId,
        status: "PAID",
        method: { not: "VALE" },
        settledAt: settledAt ?? { not: null },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.accountPayable.aggregate({
      where: {
        organizationId: context.organizationId,
        status: "PAID",
        paidAt: paidAt ?? { not: null },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.bankStatementEntry.aggregate({
      where: {
        organizationId: context.organizationId,
        ...(period.from || period.to
          ? {
              occurredAt: {
                ...(period.from ? { gte: period.from } : {}),
                ...(period.to ? { lte: period.to } : {}),
              },
            }
          : {}),
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.bankReconciliation.aggregate({
      where: {
        organizationId: context.organizationId,
        ...(period.from || period.to
          ? {
              reconciledAt: {
                ...(period.from ? { gte: period.from } : {}),
                ...(period.to ? { lte: period.to } : {}),
              },
            }
          : {}),
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const [manualDebts, manualReceiptsInPeriod] = await Promise.all([
    db.clientManualReceivable.findMany({
      where: { organizationId: context.organizationId },
      include: { receipts: { select: { amount: true } } },
    }),
    db.clientManualReceipt.findMany({
      where: {
        organizationId: context.organizationId,
        ...((period.from || period.to) ? { receivedAt: {
          ...(period.from ? { gte: period.from } : {}),
          ...(period.to ? { lte: period.to } : {}),
        } } : {}),
      },
      select: { amount: true },
    }),
  ]);
  const openManual = manualDebts.map((debt) => ({
    dueDate: debt.dueDate,
    outstanding: debt.amount.sub(decimalSum(debt.receipts.map((receipt) => receipt.amount))),
  })).filter((item) => item.outstanding.gt(0));
  const manualOutstanding = decimalSum(openManual.map((item) => item.outstanding));
  const overdueManual = openManual.filter((item) => item.dueDate < now);
  const manualOverdue = decimalSum(overdueManual.map((item) => item.outstanding));
  const manualInflow = decimalSum(manualReceiptsInPeriod.map((item) => item.amount));

  const [chequeReturns, periodReturns, periodRecoveries] = await Promise.all([
    db.saleChequeReturn.findMany({
      where: { organizationId: context.organizationId },
      include: { payment: { select: { amount: true } },
        recoveries: { select: { amount: true } } },
    }),
    db.saleChequeReturn.findMany({
      where: {
        organizationId: context.organizationId,
        ...((period.from || period.to) ? { returnedAt: {
          ...(period.from ? { gte: period.from } : {}),
          ...(period.to ? { lte: period.to } : {}),
        } } : {}),
      },
      select: { payment: { select: { amount: true } } },
    }),
    db.saleChequeRecovery.findMany({
      where: {
        organizationId: context.organizationId,
        ...((period.from || period.to) ? { receivedAt: {
          ...(period.from ? { gte: period.from } : {}),
          ...(period.to ? { lte: period.to } : {}),
        } } : {}),
      },
      select: { amount: true },
    }),
  ]);
  const chequeOutstanding = chequeReturns.map((item) =>
    item.payment.amount.sub(decimalSum(item.recoveries.map((row) => row.amount))));
  const openReturns = chequeOutstanding.filter((amount) => amount.gt(0));
  const outstanding = decimalSum(openReturns);
  const reversedDuringPeriod = decimalSum(periodReturns.map((item) => item.payment.amount));
  const recoveredDuringPeriod = decimalSum(periodRecoveries.map((item) => item.amount));
  const inflow = (realizedReceipts._sum.amount ?? new Prisma.Decimal(0))
    .add(recoveredDuringPeriod).add(manualInflow);
  const outflow = (realizedPayments._sum.amount ?? new Prisma.Decimal(0)).add(reversedDuringPeriod);

  return {
    period,
    accountsReceivable: {
      pendingCount: receivableOpen._count._all + openReturns.length + openManual.length,
      pendingAmount: (receivableOpen._sum.amount ?? new Prisma.Decimal(0)).add(outstanding).add(manualOutstanding),
      overdueCount: receivableOverdue._count._all + openReturns.length + overdueManual.length,
      overdueAmount: (receivableOverdue._sum.amount ?? new Prisma.Decimal(0)).add(outstanding).add(manualOverdue),
    },
    manualReceivables: {
      totalCount: manualDebts.length,
      openCount: openManual.length,
      outstandingAmount: manualOutstanding,
      overdueAmount: manualOverdue,
      receivedDuringPeriod: manualInflow,
    },
    chequeReturns: {
      totalCount: chequeReturns.length,
      openCount: openReturns.length,
      outstandingAmount: outstanding,
      reversedDuringPeriod,
      recoveredDuringPeriod,
    },
    accountsPayable: {
      pendingCount: payableOpen._count._all,
      pendingAmount: payableOpen._sum.amount ?? new Prisma.Decimal(0),
      overdueCount: payableOverdue._count._all,
      overdueAmount: payableOverdue._sum.amount ?? new Prisma.Decimal(0),
    },
    cashFlow: {
      receiptCount: realizedReceipts._count._all + periodRecoveries.length + manualReceiptsInPeriod.length,
      inflow,
      paymentCount: realizedPayments._count._all + periodReturns.length,
      outflow,
      net: inflow.minus(outflow),
    },
    bankReconciliation: {
      bankEntryCount: bankEntries._count._all,
      bankEntryAmount: bankEntries._sum.amount ?? new Prisma.Decimal(0),
      reconciliationCount: reconciliations._count._all,
      reconciledAmount: reconciliations._sum.amount ?? new Prisma.Decimal(0),
    },
  };
}
