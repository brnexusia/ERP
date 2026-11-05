import { type MembershipRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { PromotionDraftCreateInput } from "@/modules/promotions/schema";

export type PromotionAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class PromotionDraftNotFoundError extends Error {
  constructor(message = "Registro de promoção não encontrado nesta empresa.") {
    super(message);
    this.name = "PromotionDraftNotFoundError";
  }
}

export async function listPromotionDrafts(context: PromotionAccessContext) {
  assertPermission(context.role, "organization:manage");
  return db.promotionDraft.findMany({
    where: { organizationId: context.organizationId },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPromotionDraft(
  context: PromotionAccessContext,
  input: PromotionDraftCreateInput,
) {
  assertPermission(context.role, "organization:manage");

  return db.$transaction(async (tx) => {
    if (input.kind === "PRODUCT") {
      const exists = await tx.product.findFirst({
        where: { id: input.productId, organizationId: context.organizationId },
        select: { id: true },
      });
      if (!exists) throw new PromotionDraftNotFoundError("Produto não encontrado nesta empresa.");
    }
    if (input.kind === "CATEGORY") {
      const exists = await tx.productCategory.findFirst({
        where: { id: input.categoryId, organizationId: context.organizationId },
        select: { id: true },
      });
      if (!exists) throw new PromotionDraftNotFoundError("Categoria não encontrada nesta empresa.");
    }

    const draft = await tx.promotionDraft.create({
      data: {
        organizationId: context.organizationId,
        createdByUserId: context.userId,
        name: input.name,
        notes: input.notes ?? null,
        kind: input.kind,
        productId: input.kind === "PRODUCT" ? input.productId : null,
        categoryId: input.kind === "CATEGORY" ? input.categoryId : null,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        category: { select: { id: true, name: true } },
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PROMOTION_DRAFT_CREATE",
        entityType: "PromotionDraft",
        entityId: draft.id,
        metadata: { kind: draft.kind, productId: draft.productId, categoryId: draft.categoryId },
      },
    });
    return draft;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deletePromotionDraft(context: PromotionAccessContext, id: string) {
  assertPermission(context.role, "organization:manage");
  return db.$transaction(async (tx) => {
    const draft = await tx.promotionDraft.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!draft) throw new PromotionDraftNotFoundError();
    await tx.promotionDraft.delete({ where: { id: draft.id } });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PROMOTION_DRAFT_DELETE",
        entityType: "PromotionDraft",
        entityId: draft.id,
        metadata: { kind: draft.kind, productId: draft.productId, categoryId: draft.categoryId },
      },
    });
    return { id: draft.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
