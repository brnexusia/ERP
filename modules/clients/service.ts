import { Prisma, type ClientDocumentType, type MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import { detectDocumentType } from "@/modules/clients/document";
import type { ClientCreateInput, ClientUpdateInput } from "@/modules/clients/schema";

export type ClientAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class ClientConflictError extends Error {
  constructor() {
    super("Já existe um cliente com este CPF/CNPJ nesta empresa.");
    this.name = "ClientConflictError";
  }
}

export class ClientNotFoundError extends Error {
  constructor() {
    super("Cliente não encontrado.");
    this.name = "ClientNotFoundError";
  }
}

function throwIfUniqueConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ClientConflictError();
  }
  throw error;
}

export async function listClients(context: ClientAccessContext) {
  assertPermission(context.role, "clients:read");

  return db.client.findMany({
    where: { organizationId: context.organizationId },
    include: { address: true, segment: true },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
}

export async function getClient(context: ClientAccessContext, clientId: string) {
  assertPermission(context.role, "clients:read");

  return db.client.findFirst({
    where: {
      id: clientId,
      organizationId: context.organizationId,
    },
    include: { address: true, segment: true },
  });
}

export async function createClient(context: ClientAccessContext, input: ClientCreateInput) {
  assertPermission(context.role, "clients:write");
  const documentType = detectDocumentType(input.document);
  if (!documentType) throw new Error("CPF/CNPJ inválido.");

  try {
    return await db.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          documentType,
          document: input.document,
          whatsapp: input.whatsapp,
          email: input.email,
          address: {
            create: {
              organizationId: context.organizationId,
              postalCode: input.address.postalCode,
              street: input.address.street,
              number: input.address.number,
              complement: input.address.complement ?? null,
              district: input.address.district,
              city: input.address.city,
              state: input.address.state,
              country: input.address.country,
            },
          },
        },
        include: { address: true, segment: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "CLIENT_CREATE",
          entityType: "Client",
          entityId: client.id,
          metadata: { documentType },
        },
      });

      return client;
    });
  } catch (error) {
    throwIfUniqueConflict(error);
  }
}

export async function updateClient(
  context: ClientAccessContext,
  clientId: string,
  input: ClientUpdateInput,
) {
  assertPermission(context.role, "clients:write");

  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.client.findFirst({
        where: {
          id: clientId,
          organizationId: context.organizationId,
        },
        include: { address: true },
      });

      if (!current) throw new ClientNotFoundError();

      let documentType: ClientDocumentType | undefined;
      if (input.document) {
        const detectedDocumentType = detectDocumentType(input.document);
        if (!detectedDocumentType) throw new Error("CPF/CNPJ inválido.");
        documentType = detectedDocumentType;
      }

      if (input.address && !current.address) {
        throw new Error("Endereço do cliente não encontrado.");
      }

      const client = await tx.client.update({
        where: { id: current.id },
        data: {
          name: input.name,
          document: input.document,
          documentType,
          whatsapp: input.whatsapp,
          email: input.email,
          address: input.address
            ? {
                update: {
                  postalCode: input.address.postalCode,
                  street: input.address.street,
                  number: input.address.number,
                  complement: input.address.complement,
                  district: input.address.district,
                  city: input.address.city,
                  state: input.address.state,
                  country: input.address.country,
                },
              }
            : undefined,
        },
        include: { address: true, segment: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "CLIENT_UPDATE",
          entityType: "Client",
          entityId: client.id,
        },
      });

      return client;
    });
  } catch (error) {
    if (error instanceof ClientNotFoundError) throw error;
    throwIfUniqueConflict(error);
  }
}
