import { db } from "@/lib/db";

export async function assertOrganizationMembership(userId: string, organizationId: string) {
  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      organization: true,
      user: true,
    },
  });

  if (
    !membership ||
    membership.organization.status !== "ACTIVE" ||
    membership.user.status !== "ACTIVE"
  ) {
    throw new Error("Acesso não autorizado para esta empresa.");
  }

  return membership;
}

export async function listTenantIntegrations(organizationId: string) {
  return db.integration.findMany({
    where: { organizationId },
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
  });
}

export async function findTenantIntegration(organizationId: string, integrationId: string) {
  return db.integration.findFirst({
    where: {
      id: integrationId,
      organizationId,
    },
  });
}

export async function writeTenantAudit(input: {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
