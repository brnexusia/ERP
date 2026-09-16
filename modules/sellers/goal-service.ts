import { Prisma, type SellerGoalMetric } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type { ReportPeriod } from "@/modules/reports/schema";
import type { CreateSellerGoalInput, UpdateSellerGoalInput } from "@/modules/sellers/goal-schema";

export class SellerGoalNotFoundError extends Error {
  constructor(message = "Meta da vendedora não encontrada.") {
    super(message);
    this.name = "SellerGoalNotFoundError";
  }
}

export class SellerGoalRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SellerGoalRuleError";
  }
}

async function ensureSeller(context: ClientAccessContext, membershipId: string) {
  const seller = await db.membership.findFirst({
    where: {
      id: membershipId,
      organizationId: context.organizationId,
      role: "SELLER",
      user: { status: "ACTIVE" },
    },
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  });
  if (!seller) throw new SellerGoalNotFoundError("Vendedora não encontrada.");
  return seller;
}

function validateDefinition(
  metric: SellerGoalMetric,
  targetValue: Prisma.Decimal,
  startAt: Date,
  endAt: Date,
) {
  if (targetValue.lte(0)) throw new SellerGoalRuleError("Meta deve ser maior que zero.");
  if (endAt < startAt) throw new SellerGoalRuleError("Fim da meta deve ser igual ou posterior ao início.");
  if (metric !== "REVENUE" && !targetValue.mod(1).eq(0)) {
    throw new SellerGoalRuleError("Metas de vendas ou clientes exigem quantidade inteira.");
  }
}

function actualForMetric(
  metric: SellerGoalMetric,
  sales: Array<{ totalAmount: Prisma.Decimal; clientId: string }>,
) {
  if (metric === "SALES") return new Prisma.Decimal(sales.length);
  if (metric === "CLIENTS") return new Prisma.Decimal(new Set(sales.map((sale) => sale.clientId)).size);
  return sales.reduce((total, sale) => total.add(sale.totalAmount), new Prisma.Decimal(0));
}

function periodStatus(startAt: Date, endAt: Date) {
  const now = Date.now();
  if (now < startAt.getTime()) return "UPCOMING" as const;
  if (now > endAt.getTime()) return "ENDED" as const;
  return "ACTIVE" as const;
}

async function withProgress(context: ClientAccessContext, goal: {
  id: string;
  organizationId: string;
  sellerMembershipId: string;
  metric: SellerGoalMetric;
  targetValue: Prisma.Decimal;
  startAt: Date;
  endAt: Date;
  note: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const sales = await db.sale.findMany({
    where: {
      organizationId: context.organizationId,
      sellerMembershipId: goal.sellerMembershipId,
      stage: "PAID",
      paidAt: { gte: goal.startAt, lte: goal.endAt },
    },
    select: { totalAmount: true, clientId: true },
  });

  const actualValue = actualForMetric(goal.metric, sales);
  const progressPercent = actualValue
    .div(goal.targetValue)
    .mul(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    ...goal,
    actualValue,
    progressPercent,
    achieved: actualValue.gte(goal.targetValue),
    status: periodStatus(goal.startAt, goal.endAt),
  };
}

export async function listSellerGoalsWithProgress(
  context: ClientAccessContext,
  sellerMembershipId: string,
) {
  assertPermission(context.role, "sales:read");
  const seller = await ensureSeller(context, sellerMembershipId);
  const goals = await db.sellerGoal.findMany({
    where: {
      organizationId: context.organizationId,
      sellerMembershipId: seller.id,
    },
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
  });

  return Promise.all(goals.map((goal) => withProgress(context, goal)));
}

export async function getSellerGoalsDashboard(
  context: ClientAccessContext,
  period: ReportPeriod,
) {
  assertPermission(context.role, "sales:read");

  const overlap = period.start || period.end
    ? {
        AND: [
          ...(period.end ? [{ startAt: { lte: period.end } }] : []),
          ...(period.start ? [{ endAt: { gte: period.start } }] : []),
        ],
      }
    : {};

  const goals = await db.sellerGoal.findMany({
    where: {
      organizationId: context.organizationId,
      ...overlap,
    },
    include: {
      seller: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
  });

  const tracked = await Promise.all(goals.map(async (goal) => {
    const progress = await withProgress(context, goal);
    return {
      ...progress,
      seller: {
        membershipId: goal.seller.id,
        user: goal.seller.user,
      },
    };
  }));

  return {
    summary: {
      total: tracked.length,
      achieved: tracked.filter((goal) => goal.achieved).length,
      active: tracked.filter((goal) => goal.status === "ACTIVE").length,
      upcoming: tracked.filter((goal) => goal.status === "UPCOMING").length,
      ended: tracked.filter((goal) => goal.status === "ENDED").length,
    },
    goals: tracked,
  };
}

export async function createSellerGoal(
  context: ClientAccessContext,
  sellerMembershipId: string,
  input: CreateSellerGoalInput,
) {
  assertPermission(context.role, "organization:manage");
  const seller = await ensureSeller(context, sellerMembershipId);
  const targetValue = new Prisma.Decimal(input.targetValue);
  validateDefinition(input.metric, targetValue, input.startAt, input.endAt);

  const goal = await db.$transaction(async (tx) => {
    const created = await tx.sellerGoal.create({
      data: {
        organizationId: context.organizationId,
        sellerMembershipId: seller.id,
        metric: input.metric,
        targetValue,
        startAt: input.startAt,
        endAt: input.endAt,
        note: input.note ?? null,
        createdByUserId: context.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SELLER_GOAL_CREATE",
        entityType: "SellerGoal",
        entityId: created.id,
        metadata: {
          sellerMembershipId: seller.id,
          metric: created.metric,
          targetValue: created.targetValue.toFixed(2),
          startAt: created.startAt.toISOString(),
          endAt: created.endAt.toISOString(),
        },
      },
    });
    return created;
  });

  return withProgress(context, goal);
}

export async function updateSellerGoal(
  context: ClientAccessContext,
  sellerMembershipId: string,
  goalId: string,
  input: UpdateSellerGoalInput,
) {
  assertPermission(context.role, "organization:manage");
  const seller = await ensureSeller(context, sellerMembershipId);
  const current = await db.sellerGoal.findFirst({
    where: {
      id: goalId,
      organizationId: context.organizationId,
      sellerMembershipId: seller.id,
    },
  });
  if (!current) throw new SellerGoalNotFoundError();

  const metric = input.metric ?? current.metric;
  const targetValue = input.targetValue === undefined ? current.targetValue : new Prisma.Decimal(input.targetValue);
  const startAt = input.startAt ?? current.startAt;
  const endAt = input.endAt ?? current.endAt;
  validateDefinition(metric, targetValue, startAt, endAt);

  const goal = await db.$transaction(async (tx) => {
    const updated = await tx.sellerGoal.update({
      where: { id: current.id },
      data: {
        metric: input.metric,
        targetValue: input.targetValue === undefined ? undefined : targetValue,
        startAt: input.startAt,
        endAt: input.endAt,
        note: input.note,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SELLER_GOAL_UPDATE",
        entityType: "SellerGoal",
        entityId: updated.id,
        metadata: {
          sellerMembershipId: seller.id,
          metric: updated.metric,
          targetValue: updated.targetValue.toFixed(2),
          startAt: updated.startAt.toISOString(),
          endAt: updated.endAt.toISOString(),
        },
      },
    });
    return updated;
  });

  return withProgress(context, goal);
}

export async function deleteSellerGoal(
  context: ClientAccessContext,
  sellerMembershipId: string,
  goalId: string,
) {
  assertPermission(context.role, "organization:manage");
  const seller = await ensureSeller(context, sellerMembershipId);
  const current = await db.sellerGoal.findFirst({
    where: {
      id: goalId,
      organizationId: context.organizationId,
      sellerMembershipId: seller.id,
    },
  });
  if (!current) throw new SellerGoalNotFoundError();

  await db.$transaction(async (tx) => {
    await tx.sellerGoal.delete({ where: { id: current.id } });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "SELLER_GOAL_DELETE",
        entityType: "SellerGoal",
        entityId: current.id,
        metadata: { sellerMembershipId: seller.id },
      },
    });
  });

  return { id: current.id };
}
