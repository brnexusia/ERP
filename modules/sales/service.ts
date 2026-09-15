import { PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type {
  ClientSellerAssignmentInput,
  SaleCreateInput,
  SalePaymentCreateInput,
  SalePaymentUpdateInput,
  SaleQuoteUpdateInput,
} from "@/modules/sales/schema";

export class SaleNotFoundError extends Error {
  constructor(message = "Venda não encontrada.") {
    super(message);
    this.name = "SaleNotFoundError";
  }
}

export class SaleRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleRuleError";
  }
}

function saleInclude() {
  return {
    client: {
      include: {
        segment: true,
        responsibleSeller: { include: { user: true } },
      },
    },
    seller: { include: { user: true } },
    items: {
      include: { product: { include: { category: true, subcategory: true } } },
      orderBy: { createdAt: "asc" as const },
    },
    payments: { orderBy: { createdAt: "asc" as const } },
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

async function getSellerMembership(
  tx: Prisma.TransactionClient | typeof db,
  organizationId: string,
  membershipId: string,
) {
  const membership = await tx.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
      role: "SELLER",
      user: { status: "ACTIVE" },
    },
    include: { user: true },
  });
  if (!membership) {
    throw new SaleRuleError("Vendedora responsável inválida para esta empresa.");
  }
  return membership;
}

async function getClientForSale(
  tx: Prisma.TransactionClient | typeof db,
  organizationId: string,
  clientId: string,
) {
  const client = await tx.client.findFirst({
    where: { id: clientId, organizationId },
    include: { responsibleSeller: { include: { user: true } } },
  });
  if (!client) throw new SaleNotFoundError("Cliente não encontrado.");
  return client;
}

async function buildItems(
  tx: Prisma.TransactionClient,
  organizationId: string,
  items: Array<{ productId: string; quantity: string }>,
) {
  const quantities = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    const current = quantities.get(item.productId) ?? new Prisma.Decimal(0);
    quantities.set(item.productId, current.add(new Prisma.Decimal(item.quantity)));
  }

  const productIds = [...quantities.keys()];
  const products = await tx.product.findMany({
    where: { organizationId, id: { in: productIds } },
  });

  if (products.length !== productIds.length) {
    throw new SaleRuleError("Um ou mais produtos não pertencem à empresa ativa.");
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  let totalAmount = new Prisma.Decimal(0);
  const rows = productIds.map((productId) => {
    const product = byId.get(productId)!;
    const quantity = quantities.get(productId)!;
    const lineTotal = product.salePrice.mul(quantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    totalAmount = totalAmount.add(lineTotal);
    return {
      organizationId,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity,
      unitPrice: product.salePrice,
      lineTotal,
    };
  });

  return { rows, totalAmount: totalAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) };
}

export async function listSellers(context: ClientAccessContext) {
  assertPermission(context.role, "sales:read");
  return db.membership.findMany({
    where: {
      organizationId: context.organizationId,
      role: "SELLER",
      user: { status: "ACTIVE" },
    },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
}

export async function assignResponsibleSeller(
  context: ClientAccessContext,
  clientId: string,
  input: ClientSellerAssignmentInput,
) {
  assertPermission(context.role, "clients:write");

  return db.$transaction(async (tx) => {
    const client = await getClientForSale(tx, context.organizationId, clientId);
    if (input.membershipId) {
      await getSellerMembership(tx, context.organizationId, input.membershipId);
    }

    const updated = await tx.client.update({
      where: { id: client.id },
      data: { responsibleSellerMembershipId: input.membershipId },
      include: {
        responsibleSeller: { include: { user: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_RESPONSIBLE_SELLER_ASSIGN",
        entityType: "Client",
        entityId: client.id,
        metadata: { responsibleSellerMembershipId: input.membershipId },
      },
    });

    return updated;
  });
}

export async function listSales(context: ClientAccessContext) {
  assertPermission(context.role, "sales:read");
  return db.sale.findMany({
    where: { organizationId: context.organizationId },
    include: saleInclude(),
    orderBy: { createdAt: "desc" },
  });
}

export async function getSale(context: ClientAccessContext, saleId: string) {
  assertPermission(context.role, "sales:read");
  return db.sale.findFirst({
    where: { id: saleId, organizationId: context.organizationId },
    include: saleInclude(),
  });
}

export async function createQuote(context: ClientAccessContext, input: SaleCreateInput) {
  assertPermission(context.role, "sales:write");

  return db.$transaction(async (tx) => {
    const client = await getClientForSale(tx, context.organizationId, input.clientId);
    const sellerMembershipId = input.sellerMembershipId ?? client.responsibleSellerMembershipId;
    if (!sellerMembershipId) {
      throw new SaleRuleError("Defina a vendedora responsável antes de criar o orçamento.");
    }
    await getSellerMembership(tx, context.organizationId, sellerMembershipId);
    const { rows, totalAmount } = await buildItems(tx, context.organizationId, input.items);

    const sale = await tx.sale.create({
      data: {
        organizationId: context.organizationId,
        clientId: client.id,
        sellerMembershipId,
        channel: input.channel,
        totalAmount,
        items: { create: rows },
      },
      include: saleInclude(),
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_QUOTE_CREATE",
        entityType: "Sale",
        entityId: sale.id,
        metadata: {
          clientId: sale.clientId,
          sellerMembershipId: sale.sellerMembershipId,
          channel: sale.channel,
          totalAmount: sale.totalAmount.toFixed(2),
        },
      },
    });

    return sale;
  });
}

export async function updateQuote(
  context: ClientAccessContext,
  saleId: string,
  input: SaleQuoteUpdateInput,
) {
  assertPermission(context.role, "sales:write");

  return db.$transaction(async (tx) => {
    const current = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
      include: { items: true },
    });
    if (!current) throw new SaleNotFoundError();
    if (current.stage !== "QUOTE") {
      throw new SaleRuleError("Somente orçamentos podem ter itens, canal ou vendedora alterados.");
    }

    if (input.sellerMembershipId) {
      await getSellerMembership(tx, context.organizationId, input.sellerMembershipId);
    }

    let totalAmount = current.totalAmount;
    let itemUpdate: Prisma.SaleItemUpdateManyWithoutSaleNestedInput | undefined;
    if (input.items) {
      const built = await buildItems(tx, context.organizationId, input.items);
      totalAmount = built.totalAmount;
      itemUpdate = {
        deleteMany: {},
        create: built.rows,
      };
    }

    const sale = await tx.sale.update({
      where: { id: current.id },
      data: {
        sellerMembershipId: input.sellerMembershipId,
        channel: input.channel,
        totalAmount,
        items: itemUpdate,
      },
      include: saleInclude(),
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_QUOTE_UPDATE",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { totalAmount: sale.totalAmount.toFixed(2) },
      },
    });

    return sale;
  });
}

export async function confirmOrder(context: ClientAccessContext, saleId: string) {
  assertPermission(context.role, "sales:write");

  return runSerializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
      include: { items: true },
    });
    if (!sale) throw new SaleNotFoundError();
    if (sale.stage !== "QUOTE") {
      throw new SaleRuleError("Apenas um orçamento pode evoluir para pedido.");
    }
    if (sale.items.length === 0 || sale.totalAmount.lte(0)) {
      throw new SaleRuleError("O orçamento precisa ter produtos e valor antes de virar pedido.");
    }

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: { stage: "ORDER", orderedAt: new Date() },
      include: saleInclude(),
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_ORDER_CONFIRM",
        entityType: "Sale",
        entityId: sale.id,
      },
    });

    return updated;
  });
}

async function refreshSalePaymentStage(tx: Prisma.TransactionClient, saleId: string) {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    include: { payments: true },
  });
  if (!sale) throw new SaleNotFoundError();

  const settled = sale.payments
    .filter((payment) => payment.status === PaymentStatus.PAID)
    .reduce((total, payment) => total.add(payment.amount), new Prisma.Decimal(0));

  if (settled.gte(sale.totalAmount) && sale.stage === "ORDER") {
    return tx.sale.update({
      where: { id: sale.id },
      data: { stage: "PAID", paidAt: new Date() },
      include: saleInclude(),
    });
  }

  return tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: saleInclude() });
}

export async function addSalePayment(
  context: ClientAccessContext,
  saleId: string,
  input: SalePaymentCreateInput,
) {
  assertPermission(context.role, "sales:write");

  return runSerializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
      include: { payments: true },
    });
    if (!sale) throw new SaleNotFoundError();
    if (sale.stage !== "ORDER") {
      throw new SaleRuleError("Pagamentos só podem ser registrados em pedidos ainda não quitados.");
    }

    const amount = new Prisma.Decimal(input.amount);
    const registeredAmount = sale.payments.reduce(
      (total, payment) => total.add(payment.amount),
      new Prisma.Decimal(0),
    );
    if (registeredAmount.add(amount).gt(sale.totalAmount)) {
      throw new SaleRuleError("A soma dos pagamentos não pode ultrapassar o valor do pedido.");
    }

    const payment = await tx.salePayment.create({
      data: {
        organizationId: context.organizationId,
        saleId: sale.id,
        method: input.method,
        status: input.status,
        amount,
        dueDate: input.dueDate ?? null,
        settledAt: input.status === "PAID" ? new Date() : null,
      },
    });

    const updatedSale = await refreshSalePaymentStage(tx, sale.id);

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_PAYMENT_CREATE",
        entityType: "SalePayment",
        entityId: payment.id,
        metadata: {
          saleId: sale.id,
          method: payment.method,
          status: payment.status,
          amount: payment.amount.toFixed(2),
        },
      },
    });

    return { payment, sale: updatedSale };
  });
}

export async function updateSalePayment(
  context: ClientAccessContext,
  saleId: string,
  paymentId: string,
  input: SalePaymentUpdateInput,
) {
  assertPermission(context.role, "sales:write");

  return runSerializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId: context.organizationId },
    });
    if (!sale) throw new SaleNotFoundError();
    if (sale.stage !== "ORDER") {
      throw new SaleRuleError("Pagamentos de uma venda já quitada não podem ser revertidos.");
    }

    const current = await tx.salePayment.findFirst({
      where: { id: paymentId, saleId: sale.id, organizationId: context.organizationId },
    });
    if (!current) throw new SaleNotFoundError("Pagamento não encontrado.");
    if (current.status === "PAID" && input.status !== "PAID") {
      throw new SaleRuleError("Um pagamento quitado não pode voltar para pendente.");
    }

    const payment = await tx.salePayment.update({
      where: { id: current.id },
      data: {
        status: input.status,
        settledAt: input.status === "PAID" ? current.settledAt ?? new Date() : null,
      },
    });
    const updatedSale = await refreshSalePaymentStage(tx, sale.id);

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SALE_PAYMENT_UPDATE",
        entityType: "SalePayment",
        entityId: payment.id,
        metadata: { saleId: sale.id, status: payment.status },
      },
    });

    return { payment, sale: updatedSale };
  });
}

export async function getClientPurchaseHistory(context: ClientAccessContext, clientId: string) {
  assertPermission(context.role, "sales:read");
  await getClientForSale(db, context.organizationId, clientId);

  return db.sale.findMany({
    where: {
      organizationId: context.organizationId,
      clientId,
      stage: "PAID",
    },
    include: saleInclude(),
    orderBy: { paidAt: "desc" },
  });
}
