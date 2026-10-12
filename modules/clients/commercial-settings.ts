import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, PermissionDeniedError } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";

const managerRoles = ["OWNER", "ADMIN", "MANAGER"];
function requireManager(context: ClientAccessContext) {
  if (!managerRoles.includes(context.role)) {
    throw new PermissionDeniedError("organization:manage");
  }
}
const percent = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .refine((value) => /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/.test(value), "Percentual entre 0 e 100.");

export const representativeCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  whatsapp: z.string().trim().max(20).nullable().optional(),
  commissionPercent: percent.nullable().optional(),
});

export const creditPolicySchema = z.object({
  creditAllowed: z.boolean(),
  creditMethods: z.array(z.enum(["CHEQUE", "BOLETO", "VALE"])).max(3),
}).superRefine((value, ctx) => {
  if (!value.creditAllowed && value.creditMethods.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creditMethods"],
      message: "Crédito desabilitado não pode possuir modalidades autorizadas." });
  }
});

export async function listRepresentatives(context: ClientAccessContext) {
  assertPermission(context.role, "clients:read");
  return db.representative.findMany({
    where: { organizationId: context.organizationId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, whatsapp: true, commissionPercent: true },
  });
}

export async function createRepresentative(
  context: ClientAccessContext,
  input: z.infer<typeof representativeCreateSchema>,
) {
  requireManager(context);
  return db.$transaction(async (tx) => {
    const row = await tx.representative.create({
      data: {
        organizationId: context.organizationId,
        name: input.name,
        whatsapp: input.whatsapp || null,
        commissionPercent: input.commissionPercent === undefined ||
          input.commissionPercent === null ? null : new Prisma.Decimal(input.commissionPercent),
      },
    });
    await tx.auditLog.create({
      data: { organizationId: context.organizationId, userId: context.userId,
        action: "REPRESENTATIVE_CREATE", entityType: "Representative", entityId: row.id },
    });
    return row;
  });
}

export async function updateClientCreditPolicy(
  context: ClientAccessContext,
  clientId: string,
  input: z.infer<typeof creditPolicySchema>,
) {
  requireManager(context);
  return db.$transaction(async (tx) => {
    const existing = await tx.client.findFirst({
      where: { id: clientId, organizationId: context.organizationId },
      select: { id: true, creditAllowed: true, creditMethods: true },
    });
    if (!existing) return null;
    const client = await tx.client.update({
      where: { id: existing.id },
      data: { creditAllowed: input.creditAllowed, creditMethods: input.creditMethods },
      include: { address: true, segment: true, representative: true },
    });
    await tx.auditLog.create({
      data: { organizationId: context.organizationId, userId: context.userId,
        action: "CLIENT_CREDIT_POLICY_UPDATE", entityType: "Client", entityId: client.id,
        metadata: {
          previous: { allowed: existing.creditAllowed, methods: existing.creditMethods },
          next: { allowed: input.creditAllowed, methods: input.creditMethods },
        },
      },
    });
    return client;
  });
}
