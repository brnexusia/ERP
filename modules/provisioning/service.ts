import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { OrganizationProvisioningInput } from "@/modules/provisioning/schema";

export class ProvisioningConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisioningConflictError";
  }
}

export async function provisionOrganization(input: OrganizationProvisioningInput) {
  const passwordHash = await hashPassword(input.ownerPassword);

  try {
    return await db.$transaction(async (tx) => {
      const existingOrganization = await tx.organization.findUnique({
        where: { slug: input.organizationSlug },
        select: { id: true },
      });
      if (existingOrganization) {
        throw new ProvisioningConflictError("Já existe uma empresa com este slug.");
      }

      const existingUser = await tx.user.findUnique({
        where: { email: input.ownerEmail },
        select: { id: true },
      });
      if (existingUser) {
        throw new ProvisioningConflictError(
          "Já existe um usuário com este e-mail. Vincule o usuário existente pela gestão de acessos em vez de redefinir sua senha global.",
        );
      }

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.organizationSlug,
          status: "ACTIVE",
        },
      });

      const owner = await tx.user.create({
        data: {
          name: input.ownerName,
          email: input.ownerEmail,
          passwordHash,
          status: "ACTIVE",
        },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: owner.id,
          role: "OWNER",
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: owner.id,
          action: "ORGANIZATION_PROVISIONED",
          entityType: "Organization",
          entityId: organization.id,
          metadata: {
            organizationSlug: organization.slug,
            ownerMembershipId: membership.id,
            ownerUserId: owner.id,
          },
        },
      });

      return {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
        },
        owner: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
        },
        membership: {
          id: membership.id,
          role: membership.role,
        },
      };
    });
  } catch (error) {
    if (error instanceof ProvisioningConflictError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ProvisioningConflictError("Empresa ou usuário já existente.");
    }
    throw error;
  }
}
