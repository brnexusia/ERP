import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { ProductNotFoundError } from "@/modules/products/service";
import { removeStoredFile, storeFile } from "@/modules/storage/service";

export async function attachProductImage(
  context: ClientAccessContext,
  productId: string,
  file: File,
  variation?: string | null,
) {
  assertPermission(context.role, "inventory:write");

  const product = await db.product.findFirst({
    where: { id: productId, organizationId: context.organizationId },
    select: { id: true, name: true },
  });
  if (!product) throw new ProductNotFoundError();

  const stored = await storeFile(context, file, {
    purpose: "PRODUCT_IMAGE",
    visibility: "public",
  });

  try {
    const photo = await db.$transaction(async (tx) => {
      const created = await tx.productPhoto.create({
        data: {
          organizationId: context.organizationId,
          productId: product.id,
          url: stored.url,
          variation: variation?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "PRODUCT_PHOTO_ATTACH",
          entityType: "ProductPhoto",
          entityId: created.id,
          metadata: {
            productId: product.id,
            productName: product.name,
            variation: created.variation,
            fileToken: stored.token,
          },
        },
      });

      return created;
    });

    return { photo, file: stored };
  } catch (error) {
    await removeStoredFile(context, stored.token).catch(() => undefined);
    throw error;
  }
}
