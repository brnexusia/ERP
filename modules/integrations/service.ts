import { Prisma, type IntegrationStatus, type MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { IntegrationConfigInput } from "@/modules/integrations/schema";

export type IntegrationAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class IntegrationNotFoundError extends Error {
  constructor(message = "Integração não encontrada.") {
    super(message);
    this.name = "IntegrationNotFoundError";
  }
}

function publicIntegration<T extends { secretRef: string | null }>(integration: T) {
  const { secretRef, ...safe } = integration;
  return {
    ...safe,
    secretConfigured: Boolean(secretRef),
  };
}

function integrationSettingsData(settings: IntegrationConfigInput["settings"]) {
  if (settings === undefined) return {};
  return {
    settings: settings === null ? Prisma.DbNull : (settings as Prisma.InputJsonValue),
  };
}

export async function listIntegrations(context: IntegrationAccessContext) {
  assertPermission(context.role, "integrations:manage");

  const integrations = await db.integration.findMany({
    where: { organizationId: context.organizationId },
    orderBy: [{ provider: "asc" }, { key: "asc" }],
  });

  return integrations.map(publicIntegration);
}

export async function upsertIntegration(
  context: IntegrationAccessContext,
  input: IntegrationConfigInput,
) {
  assertPermission(context.role, "integrations:manage");

  return db.$transaction(async (tx) => {
    const existing = await tx.integration.findUnique({
      where: {
        organizationId_provider_key: {
          organizationId: context.organizationId,
          provider: input.provider,
          key: input.key,
        },
      },
    });

    const nextStatus: IntegrationStatus = input.enabled
      ? existing?.status === "CONNECTED" || existing?.status === "ERROR"
        ? existing.status
        : "DISCONNECTED"
      : "DISABLED";

    const integration = existing
      ? await tx.integration.update({
          where: { id: existing.id },
          data: {
            displayName: input.displayName,
            ...integrationSettingsData(input.settings),
            ...(input.secretRef === undefined ? {} : { secretRef: input.secretRef }),
            status: nextStatus,
          },
        })
      : await tx.integration.create({
          data: {
            organizationId: context.organizationId,
            provider: input.provider,
            key: input.key,
            displayName: input.displayName,
            ...integrationSettingsData(input.settings),
            secretRef: input.secretRef ?? null,
            status: nextStatus,
          },
        });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: existing ? "INTEGRATION_CONFIG_UPDATE" : "INTEGRATION_CONFIG_CREATE",
        entityType: "Integration",
        entityId: integration.id,
        metadata: {
          provider: integration.provider,
          key: integration.key,
          status: integration.status,
          secretConfigured: Boolean(integration.secretRef),
        },
      },
    });

    return publicIntegration(integration);
  });
}

export async function setIntegrationRuntimeStatus(
  organizationId: string,
  integrationId: string,
  status: Extract<IntegrationStatus, "CONNECTED" | "DISCONNECTED" | "ERROR">,
) {
  const integration = await db.integration.findFirst({
    where: { id: integrationId, organizationId },
  });
  if (!integration) throw new IntegrationNotFoundError();
  if (integration.status === "DISABLED") return integration;

  return db.integration.update({
    where: { id: integration.id },
    data: { status },
  });
}
