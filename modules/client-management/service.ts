import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  assertAnyPermission,
  assertPermission,
} from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type {
  ClientSegmentAssignInput,
  CreditLimitInput,
  CreditMovementInput,
  CrmEntryCreateInput,
  CrmEntryUpdateInput,
  InactivitySettingsInput,
  SegmentCreateInput,
  ValeMovementInput,
} from "@/modules/client-management/schema";

export class ClientManagementNotFoundError extends Error {
  constructor(message = "Registro não encontrado.") {
    super(message);
    this.name = "ClientManagementNotFoundError";
  }
}

export class ClientManagementConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientManagementConflictError";
  }
}

export class ClientManagementRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientManagementRuleError";
  }
}

async function assertClientInTenant(
  tx: Prisma.TransactionClient | typeof db,
  organizationId: string,
  clientId: string,
) {
  const client = await tx.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true },
  });

  if (!client) {
    throw new ClientManagementNotFoundError("Cliente não encontrado.");
  }

  return client;
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

export async function listSegments(context: ClientAccessContext) {
  assertPermission(context.role, "clients:read");

  return db.clientSegment.findMany({
    where: { organizationId: context.organizationId },
    orderBy: { name: "asc" },
  });
}

export async function createSegment(context: ClientAccessContext, input: SegmentCreateInput) {
  assertPermission(context.role, "organization:manage");

  try {
    const segment = await db.clientSegment.create({
      data: {
        organizationId: context.organizationId,
        name: input.name,
      },
    });

    await db.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_SEGMENT_CREATE",
        entityType: "ClientSegment",
        entityId: segment.id,
      },
    });

    return segment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ClientManagementConflictError("Já existe um segmento com este nome nesta empresa.");
    }
    throw error;
  }
}

export async function assignClientSegment(
  context: ClientAccessContext,
  clientId: string,
  input: ClientSegmentAssignInput,
) {
  assertPermission(context.role, "clients:write");

  return db.$transaction(async (tx) => {
    await assertClientInTenant(tx, context.organizationId, clientId);

    if (input.segmentId) {
      const segment = await tx.clientSegment.findFirst({
        where: {
          id: input.segmentId,
          organizationId: context.organizationId,
        },
        select: { id: true },
      });

      if (!segment) {
        throw new ClientManagementNotFoundError("Segmento não encontrado nesta empresa.");
      }
    }

    const client = await tx.client.update({
      where: { id: clientId },
      data: { segmentId: input.segmentId },
      include: { segment: true },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_SEGMENT_ASSIGN",
        entityType: "Client",
        entityId: client.id,
        metadata: { segmentId: input.segmentId },
      },
    });

    return client;
  });
}

export async function getClientCredit(context: ClientAccessContext, clientId: string) {
  assertAnyPermission(context.role, ["clients:read", "finance:read"]);
  await assertClientInTenant(db, context.organizationId, clientId);

  const account = await db.clientCreditAccount.findFirst({
    where: {
      organizationId: context.organizationId,
      clientId,
    },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  const creditLimit = account?.creditLimit ?? new Prisma.Decimal(0);
  const usedAmount = account?.usedAmount ?? new Prisma.Decimal(0);

  return {
    account,
    creditLimit,
    usedAmount,
    availableAmount: creditLimit.sub(usedAmount),
    movements: account?.movements ?? [],
  };
}

export async function setClientCreditLimit(
  context: ClientAccessContext,
  clientId: string,
  input: CreditLimitInput,
) {
  assertAnyPermission(context.role, ["organization:manage", "finance:write"]);
  const nextLimit = new Prisma.Decimal(input.creditLimit);

  return runSerializable(async (tx) => {
    await assertClientInTenant(tx, context.organizationId, clientId);

    const account = await tx.clientCreditAccount.upsert({
      where: { clientId },
      update: {},
      create: {
        organizationId: context.organizationId,
        clientId,
      },
    });

    if (nextLimit.lt(account.usedAmount)) {
      throw new ClientManagementRuleError(
        "O limite não pode ficar abaixo do valor de crédito já utilizado.",
      );
    }

    const updated = await tx.clientCreditAccount.update({
      where: { id: account.id },
      data: { creditLimit: nextLimit },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_CREDIT_LIMIT_UPDATE",
        entityType: "ClientCreditAccount",
        entityId: updated.id,
        metadata: {
          clientId,
          previousLimit: account.creditLimit.toFixed(2),
          creditLimit: updated.creditLimit.toFixed(2),
        },
      },
    });

    return {
      account: updated,
      availableAmount: updated.creditLimit.sub(updated.usedAmount),
    };
  });
}

export async function addClientCreditMovement(
  context: ClientAccessContext,
  clientId: string,
  input: CreditMovementInput,
) {
  assertAnyPermission(context.role, ["clients:write", "finance:write"]);
  const delta = new Prisma.Decimal(input.amountDelta);

  return runSerializable(async (tx) => {
    await assertClientInTenant(tx, context.organizationId, clientId);

    const account = await tx.clientCreditAccount.upsert({
      where: { clientId },
      update: {},
      create: {
        organizationId: context.organizationId,
        clientId,
      },
    });

    const usedAfter = account.usedAmount.add(delta);
    if (usedAfter.lt(0)) {
      throw new ClientManagementRuleError("O crédito utilizado não pode ficar negativo.");
    }
    if (usedAfter.gt(account.creditLimit)) {
      throw new ClientManagementRuleError("A movimentação ultrapassa o limite de crédito disponível.");
    }

    const [movement, updated] = await Promise.all([
      tx.clientCreditMovement.create({
        data: {
          organizationId: context.organizationId,
          clientId,
          accountId: account.id,
          amountDelta: delta,
          usedBefore: account.usedAmount,
          usedAfter,
          note: input.note ?? null,
          createdByUserId: context.userId,
        },
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      tx.clientCreditAccount.update({
        where: { id: account.id },
        data: { usedAmount: usedAfter },
      }),
    ]);

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_CREDIT_MOVEMENT",
        entityType: "ClientCreditMovement",
        entityId: movement.id,
        metadata: {
          clientId,
          amountDelta: delta.toFixed(2),
          usedAfter: usedAfter.toFixed(2),
        },
      },
    });

    return {
      movement,
      account: updated,
      availableAmount: updated.creditLimit.sub(updated.usedAmount),
    };
  });
}

export async function getClientVale(context: ClientAccessContext, clientId: string) {
  assertAnyPermission(context.role, ["clients:read", "finance:read"]);
  await assertClientInTenant(db, context.organizationId, clientId);

  const account = await db.clientValeAccount.findFirst({
    where: {
      organizationId: context.organizationId,
      clientId,
    },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    account,
    balance: account?.balance ?? new Prisma.Decimal(0),
    movements: account?.movements ?? [],
  };
}

export async function addClientValeMovement(
  context: ClientAccessContext,
  clientId: string,
  input: ValeMovementInput,
) {
  assertAnyPermission(context.role, ["clients:write", "finance:write"]);
  const delta = new Prisma.Decimal(input.amountDelta);

  return runSerializable(async (tx) => {
    await assertClientInTenant(tx, context.organizationId, clientId);

    const account = await tx.clientValeAccount.upsert({
      where: { clientId },
      update: {},
      create: {
        organizationId: context.organizationId,
        clientId,
      },
    });

    const balanceAfter = account.balance.add(delta);
    if (balanceAfter.lt(0)) {
      throw new ClientManagementRuleError("O saldo do vale não pode ficar negativo.");
    }

    const [movement, updated] = await Promise.all([
      tx.clientValeMovement.create({
        data: {
          organizationId: context.organizationId,
          clientId,
          accountId: account.id,
          amountDelta: delta,
          balanceBefore: account.balance,
          balanceAfter,
          note: input.note ?? null,
          createdByUserId: context.userId,
        },
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      tx.clientValeAccount.update({
        where: { id: account.id },
        data: { balance: balanceAfter },
      }),
    ]);

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_VALE_MOVEMENT",
        entityType: "ClientValeMovement",
        entityId: movement.id,
        metadata: {
          clientId,
          amountDelta: delta.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
        },
      },
    });

    return { movement, account: updated };
  });
}

export async function listClientCrmEntries(context: ClientAccessContext, clientId: string) {
  assertPermission(context.role, "clients:read");
  await assertClientInTenant(db, context.organizationId, clientId);

  return db.clientCrmEntry.findMany({
    where: {
      organizationId: context.organizationId,
      clientId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createClientCrmEntry(
  context: ClientAccessContext,
  clientId: string,
  input: CrmEntryCreateInput,
) {
  assertPermission(context.role, "clients:write");

  return db.$transaction(async (tx) => {
    await assertClientInTenant(tx, context.organizationId, clientId);

    const entry = await tx.clientCrmEntry.create({
      data: {
        organizationId: context.organizationId,
        clientId,
        title: input.title,
        content: input.content,
        occurredAt: input.occurredAt,
        followUpAt: input.followUpAt ?? null,
        createdByUserId: context.userId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_CRM_ENTRY_CREATE",
        entityType: "ClientCrmEntry",
        entityId: entry.id,
        metadata: { clientId },
      },
    });

    return entry;
  });
}

export async function updateClientCrmEntry(
  context: ClientAccessContext,
  clientId: string,
  entryId: string,
  input: CrmEntryUpdateInput,
) {
  assertPermission(context.role, "clients:write");

  return db.$transaction(async (tx) => {
    await assertClientInTenant(tx, context.organizationId, clientId);

    const existing = await tx.clientCrmEntry.findFirst({
      where: {
        id: entryId,
        clientId,
        organizationId: context.organizationId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new ClientManagementNotFoundError("Atividade de CRM não encontrada.");
    }

    const entry = await tx.clientCrmEntry.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        content: input.content,
        occurredAt: input.occurredAt,
        followUpAt: input.followUpAt,
        completedAt: input.completedAt,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_CRM_ENTRY_UPDATE",
        entityType: "ClientCrmEntry",
        entityId: entry.id,
        metadata: { clientId },
      },
    });

    return entry;
  });
}

export async function getClientModuleSettings(context: ClientAccessContext) {
  assertPermission(context.role, "clients:read");

  return db.clientModuleSettings.findUnique({
    where: { organizationId: context.organizationId },
  });
}

export async function updateClientModuleSettings(
  context: ClientAccessContext,
  input: InactivitySettingsInput,
) {
  assertPermission(context.role, "organization:manage");

  return db.$transaction(async (tx) => {
    const settings = await tx.clientModuleSettings.upsert({
      where: { organizationId: context.organizationId },
      update: { inactivityDays: input.inactivityDays },
      create: {
        organizationId: context.organizationId,
        inactivityDays: input.inactivityDays,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CLIENT_INACTIVITY_SETTINGS_UPDATE",
        entityType: "ClientModuleSettings",
        entityId: settings.id,
        metadata: { inactivityDays: input.inactivityDays },
      },
    });

    return settings;
  });
}
