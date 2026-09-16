import type { MembershipRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { AuditLogQuery } from "@/modules/audit/schema";

export type AuditAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export async function listAuditLogs(
  context: AuditAccessContext,
  query: AuditLogQuery,
) {
  assertPermission(context.role, "organization:manage");

  const createdAt: Prisma.DateTimeFilter | undefined = query.from || query.to
    ? {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      }
    : undefined;

  const logs = await db.auditLog.findMany({
    where: {
      organizationId: context.organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit,
  });

  return {
    filters: {
      action: query.action ?? null,
      entityType: query.entityType ?? null,
      userId: query.userId ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
      limit: query.limit,
    },
    logs,
  };
}
