import type { MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { assertPermission } from "@/lib/auth/permissions";
import type {
  OrganizationUserCreateInput,
  OrganizationUserRoleUpdateInput,
} from "@/modules/users/schema";

export type OrganizationUserAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class OrganizationUserNotFoundError extends Error {
  constructor(message = "Usuário da empresa não encontrado.") {
    super(message);
    this.name = "OrganizationUserNotFoundError";
  }
}

export class OrganizationUserRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationUserRuleError";
  }
}

function publicMembership<T extends {
  id: string;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
}>(membership: T) {
  return {
    id: membership.id,
    role: membership.role,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    user: membership.user,
  };
}

function assertOwnerRoleManagement(
  actorRole: MembershipRole,
  currentRole: MembershipRole | null,
  nextRole: MembershipRole | null,
) {
  if (actorRole !== "OWNER" && (currentRole === "OWNER" || nextRole === "OWNER")) {
    throw new OrganizationUserRuleError(
      "Somente um proprietário pode criar, alterar ou remover outro proprietário.",
    );
  }
}

async function assertNotLastOwner(
  organizationId: string,
  currentRole: MembershipRole,
  nextRole: MembershipRole | null,
) {
  if (currentRole !== "OWNER" || nextRole === "OWNER") return;

  const owners = await db.membership.count({
    where: { organizationId, role: "OWNER" },
  });
  if (owners <= 1) {
    throw new OrganizationUserRuleError(
      "A empresa precisa manter pelo menos um proprietário com acesso.",
    );
  }
}

export async function listOrganizationUsers(context: OrganizationUserAccessContext) {
  assertPermission(context.role, "users:manage");

  const memberships = await db.membership.findMany({
    where: { organizationId: context.organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return memberships.map(publicMembership);
}

export async function createOrganizationUser(
  context: OrganizationUserAccessContext,
  input: OrganizationUserCreateInput,
) {
  assertPermission(context.role, "users:manage");
  assertOwnerRoleManagement(context.role, null, input.role);

  return db.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email: input.email } });

    if (existingUser?.status === "DISABLED") {
      throw new OrganizationUserRuleError(
        "Este usuário está desativado globalmente e não pode receber acesso à empresa.",
      );
    }

    if (existingUser) {
      const existingMembership = await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: context.organizationId,
            userId: existingUser.id,
          },
        },
      });
      if (existingMembership) {
        throw new OrganizationUserRuleError("Este usuário já possui acesso à empresa.");
      }
    }

    if (!existingUser && !input.password) {
      throw new OrganizationUserRuleError(
        "Uma senha inicial é obrigatória ao criar um novo usuário.",
      );
    }

    const user = existingUser ?? await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password!),
        status: "ACTIVE",
      },
    });

    const membership = await tx.membership.create({
      data: {
        organizationId: context.organizationId,
        userId: user.id,
        role: input.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "ORGANIZATION_USER_ADD",
        entityType: "Membership",
        entityId: membership.id,
        metadata: {
          memberUserId: user.id,
          email: user.email,
          role: membership.role,
          reusedExistingUser: Boolean(existingUser),
        },
      },
    });

    return publicMembership(membership);
  });
}

export async function updateOrganizationUserRole(
  context: OrganizationUserAccessContext,
  membershipId: string,
  input: OrganizationUserRoleUpdateInput,
) {
  assertPermission(context.role, "users:manage");

  const membership = await db.membership.findFirst({
    where: { id: membershipId, organizationId: context.organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
    },
  });
  if (!membership) throw new OrganizationUserNotFoundError();

  if (membership.userId === context.userId && input.role !== membership.role) {
    throw new OrganizationUserRuleError(
      "Não é permitido alterar o próprio papel por esta rota.",
    );
  }

  assertOwnerRoleManagement(context.role, membership.role, input.role);
  await assertNotLastOwner(context.organizationId, membership.role, input.role);

  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.membership.update({
      where: { id: membership.id },
      data: { role: input.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "ORGANIZATION_USER_ROLE_UPDATE",
        entityType: "Membership",
        entityId: membership.id,
        metadata: {
          memberUserId: membership.userId,
          previousRole: membership.role,
          role: input.role,
        },
      },
    });

    return changed;
  });

  return publicMembership(updated);
}

export async function removeOrganizationUser(
  context: OrganizationUserAccessContext,
  membershipId: string,
) {
  assertPermission(context.role, "users:manage");

  const membership = await db.membership.findFirst({
    where: { id: membershipId, organizationId: context.organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
    },
  });
  if (!membership) throw new OrganizationUserNotFoundError();

  if (membership.userId === context.userId) {
    throw new OrganizationUserRuleError(
      "Não é permitido remover o próprio acesso por esta rota.",
    );
  }

  assertOwnerRoleManagement(context.role, membership.role, null);
  await assertNotLastOwner(context.organizationId, membership.role, null);

  await db.$transaction(async (tx) => {
    await tx.session.deleteMany({
      where: {
        userId: membership.userId,
        activeOrganizationId: context.organizationId,
      },
    });

    await tx.membership.delete({ where: { id: membership.id } });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "ORGANIZATION_USER_REMOVE",
        entityType: "Membership",
        entityId: membership.id,
        metadata: {
          memberUserId: membership.userId,
          email: membership.user.email,
          previousRole: membership.role,
        },
      },
    });
  });

  return { removed: true as const, membershipId: membership.id };
}
