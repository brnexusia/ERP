import { PaymentMethod, Prisma } from "@prisma/client";
import type { ClientAccessContext } from "@/modules/clients/service";

export class PaymentBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentBalanceError";
  }
}

type LedgerContext = Pick<ClientAccessContext, "organizationId" | "userId">;
type LedgerTx = Prisma.TransactionClient;

export async function reserveClientCredit(
  tx: LedgerTx,
  context: LedgerContext,
  clientId: string,
  paymentId: string,
  saleId: string,
  method: PaymentMethod,
  amount: Prisma.Decimal,
) {
  if (method !== PaymentMethod.BOLETO && method !== PaymentMethod.CHEQUE) return;
  const client = await tx.client.findFirst({
    where: { id: clientId, organizationId: context.organizationId },
    select: { id: true, creditAllowed: true, creditMethods: true },
  });
  if (!client?.creditAllowed || !client.creditMethods.includes(method)) {
    throw new PaymentBalanceError("Cliente não autorizado pelo gestor para compra a prazo nessa modalidade.");
  }
  const account = await tx.clientCreditAccount.upsert({
    where: { clientId },
    update: {},
    create: { organizationId: context.organizationId, clientId },
  });
  const nextUsed = account.usedAmount.add(amount);
  if (nextUsed.gt(account.creditLimit)) {
    throw new PaymentBalanceError("Crédito insuficiente para registrar esta parcela a prazo.");
  }
  await tx.clientCreditMovement.create({
    data: {
      organizationId: context.organizationId,
      clientId,
      accountId: account.id,
      amountDelta: amount,
      usedBefore: account.usedAmount,
      usedAfter: nextUsed,
      note: `Reserva automática ${method} | venda ${saleId} | pagamento ${paymentId}`,
      createdByUserId: context.userId,
    },
  });
  await tx.clientCreditAccount.update({ where: { id: account.id }, data: { usedAmount: nextUsed } });
  await tx.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SALE_CREDIT_RESERVED",
      entityType: "SalePayment",
      entityId: paymentId,
      metadata: { clientId, saleId, method, amount: amount.toFixed(2) },
    },
  });
}

export async function releaseClientCredit(
  tx: LedgerTx,
  context: LedgerContext,
  clientId: string,
  paymentId: string,
  saleId: string,
  method: PaymentMethod,
  amount: Prisma.Decimal,
) {
  if (method !== PaymentMethod.BOLETO && method !== PaymentMethod.CHEQUE) return;
  const account = await tx.clientCreditAccount.findFirst({
    where: { clientId, organizationId: context.organizationId },
  });
  if (!account) {
    // A legacy pending payment may predate the automatic reserve feature.
    // Never create a negative balance or invent a movement to settle it.
    return;
  }
  const reserved = await tx.auditLog.findFirst({
    where: {
      organizationId: context.organizationId,
      entityType: "SalePayment",
      entityId: paymentId,
      action: "SALE_CREDIT_RESERVED",
    },
    select: { id: true },
  });
  if (!reserved) return; // Legacy pending payment, not reserved by this flow.
  const nextUsed = account.usedAmount.sub(amount);
  if (nextUsed.lt(0)) {
    throw new PaymentBalanceError("Crédito inconsistente: a reserva deve ser conferida antes da quitação.");
  }
  await tx.clientCreditMovement.create({
    data: {
      organizationId: context.organizationId,
      clientId,
      accountId: account.id,
      amountDelta: amount.neg(),
      usedBefore: account.usedAmount,
      usedAfter: nextUsed,
      note: `Baixa automática ${method} | venda ${saleId} | pagamento ${paymentId}`,
      createdByUserId: context.userId,
    },
  });
  await tx.clientCreditAccount.update({ where: { id: account.id }, data: { usedAmount: nextUsed } });
  await tx.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SALE_CREDIT_RELEASED",
      entityType: "SalePayment",
      entityId: paymentId,
      metadata: { clientId, saleId, method, amount: amount.toFixed(2) },
    },
  });
}

export async function redeemClientVale(
  tx: LedgerTx,
  context: LedgerContext,
  clientId: string,
  paymentId: string,
  saleId: string,
  amount: Prisma.Decimal,
) {
  const account = await tx.clientValeAccount.findFirst({
    where: { clientId, organizationId: context.organizationId },
  });
  if (!account || account.balance.lt(amount)) {
    throw new PaymentBalanceError("Saldo de vale insuficiente para quitar este pagamento.");
  }
  const nextBalance = account.balance.sub(amount);
  await tx.clientValeMovement.create({
    data: {
      organizationId: context.organizationId,
      clientId,
      accountId: account.id,
      amountDelta: amount.neg(),
      balanceBefore: account.balance,
      balanceAfter: nextBalance,
      note: `Resgate automático | venda ${saleId} | pagamento ${paymentId}`,
      createdByUserId: context.userId,
    },
  });
  await tx.clientValeAccount.update({ where: { id: account.id }, data: { balance: nextBalance } });
  await tx.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SALE_VALE_REDEEMED",
      entityType: "SalePayment",
      entityId: paymentId,
      metadata: { clientId, saleId, amount: amount.toFixed(2) },
    },
  });
}
