import { randomBytes } from "node:crypto";
import { Prisma, type MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type {
  ProductCategoryCreateInput,
  ProductCreateInput,
  ProductUpdateInput,
  StockUpdateInput,
} from "@/modules/products/schema";

export type ProductAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class ProductNotFoundError extends Error {
  constructor(message = "Produto não encontrado.") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

export class ProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductConflictError";
  }
}

export class ProductRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductRuleError";
  }
}

function productInclude() {
  return {
    category: true,
    subcategory: true,
    photos: { orderBy: { createdAt: "asc" as const } },
    stock: true,
  };
}

function withStockStatus<T extends { stock: { quantity: Prisma.Decimal; minimum: Prisma.Decimal } | null }>(
  product: T,
) {
  return {
    ...product,
    lowStock: product.stock ? product.stock.quantity.lte(product.stock.minimum) : false,
  };
}

async function validateCategoryPair(
  tx: Prisma.TransactionClient | typeof db,
  organizationId: string,
  categoryId: string,
  subcategoryId?: string | null,
) {
  const category = await tx.productCategory.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!category || category.parentId) {
    throw new ProductRuleError("Categoria principal inválida para esta empresa.");
  }

  if (!subcategoryId) return { category, subcategory: null };

  const subcategory = await tx.productCategory.findFirst({
    where: { id: subcategoryId, organizationId },
  });
  if (!subcategory || subcategory.parentId !== category.id) {
    throw new ProductRuleError("Subcategoria não pertence à categoria informada.");
  }

  return { category, subcategory };
}

function mapUniqueConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : String(error.meta?.target ?? "");
    if (target.includes("sku")) throw new ProductConflictError("Já existe um produto com este SKU nesta empresa.");
    if (target.includes("barcode")) throw new ProductConflictError("Já existe um produto com este código de barras nesta empresa.");
    throw new ProductConflictError("Já existe um registro com estes dados nesta empresa.");
  }
  throw error;
}

export async function listProductCategories(context: ProductAccessContext) {
  assertPermission(context.role, "inventory:read");
  return db.productCategory.findMany({
    where: { organizationId: context.organizationId },
    include: { children: { orderBy: { name: "asc" } } },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });
}

export async function createProductCategory(
  context: ProductAccessContext,
  input: ProductCategoryCreateInput,
) {
  assertPermission(context.role, "inventory:write");

  return db.$transaction(async (tx) => {
    if (input.parentId) {
      const parent = await tx.productCategory.findFirst({
        where: { id: input.parentId, organizationId: context.organizationId },
      });
      if (!parent) throw new ProductNotFoundError("Categoria principal não encontrada.");
      if (parent.parentId) throw new ProductRuleError("O ERP suporta categoria e subcategoria em dois níveis.");
    }

    const duplicate = await tx.productCategory.findFirst({
      where: {
        organizationId: context.organizationId,
        parentId: input.parentId ?? null,
        name: input.name,
      },
      select: { id: true },
    });
    if (duplicate) throw new ProductConflictError("Já existe uma categoria com este nome neste nível.");

    const category = await tx.productCategory.create({
      data: {
        organizationId: context.organizationId,
        parentId: input.parentId ?? null,
        name: input.name,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PRODUCT_CATEGORY_CREATE",
        entityType: "ProductCategory",
        entityId: category.id,
        metadata: { parentId: category.parentId },
      },
    });

    return category;
  });
}

export async function listProducts(context: ProductAccessContext) {
  assertPermission(context.role, "inventory:read");
  const products = await db.product.findMany({
    where: { organizationId: context.organizationId },
    include: productInclude(),
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
  return products.map(withStockStatus);
}

export async function getProduct(context: ProductAccessContext, productId: string) {
  assertPermission(context.role, "inventory:read");
  const product = await db.product.findFirst({
    where: { id: productId, organizationId: context.organizationId },
    include: productInclude(),
  });
  return product ? withStockStatus(product) : null;
}

export async function createProduct(context: ProductAccessContext, input: ProductCreateInput) {
  assertPermission(context.role, "inventory:write");

  try {
    return await db.$transaction(async (tx) => {
      await validateCategoryPair(tx, context.organizationId, input.categoryId, input.subcategoryId);

      const product = await tx.product.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          sku: input.sku,
          barcode: input.barcode ?? null,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId ?? null,
          brandManufacturer: input.brandManufacturer,
          description: input.description,
          technicalAttributes: input.technicalAttributes ?? undefined,
          costPrice: new Prisma.Decimal(input.costPrice),
          salePrice: new Prisma.Decimal(input.salePrice),
          unitMeasure: input.unitMeasure,
          photos: {
            create: input.photos.map((photo) => ({
              organizationId: context.organizationId,
              url: photo.url,
              variation: photo.variation ?? null,
            })),
          },
          stock: {
            create: {
              organizationId: context.organizationId,
              quantity: new Prisma.Decimal(input.stock.quantity),
              minimum: new Prisma.Decimal(input.stock.minimum),
              maximum: new Prisma.Decimal(input.stock.maximum),
            },
          },
        },
        include: productInclude(),
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "PRODUCT_CREATE",
          entityType: "Product",
          entityId: product.id,
          metadata: { sku: product.sku, barcode: product.barcode },
        },
      });

      return withStockStatus(product);
    });
  } catch (error) {
    if (error instanceof ProductRuleError) throw error;
    mapUniqueConflict(error);
  }
}

export async function updateProduct(
  context: ProductAccessContext,
  productId: string,
  input: ProductUpdateInput,
) {
  assertPermission(context.role, "inventory:write");

  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.product.findFirst({
        where: { id: productId, organizationId: context.organizationId },
      });
      if (!current) throw new ProductNotFoundError();

      const nextCategoryId = input.categoryId ?? current.categoryId;
      const nextSubcategoryId = input.subcategoryId === undefined ? current.subcategoryId : input.subcategoryId;
      if (input.categoryId !== undefined || input.subcategoryId !== undefined) {
        await validateCategoryPair(tx, context.organizationId, nextCategoryId, nextSubcategoryId);
      }

      if (input.photos) {
        await tx.productPhoto.deleteMany({
          where: { productId: current.id, organizationId: context.organizationId },
        });
      }

      const product = await tx.product.update({
        where: { id: current.id },
        data: {
          name: input.name,
          sku: input.sku,
          barcode: input.barcode,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
          brandManufacturer: input.brandManufacturer,
          description: input.description,
          technicalAttributes:
            input.technicalAttributes === null
              ? Prisma.DbNull
              : input.technicalAttributes,
          costPrice: input.costPrice === undefined ? undefined : new Prisma.Decimal(input.costPrice),
          salePrice: input.salePrice === undefined ? undefined : new Prisma.Decimal(input.salePrice),
          unitMeasure: input.unitMeasure,
          photos: input.photos
            ? {
                create: input.photos.map((photo) => ({
                  organizationId: context.organizationId,
                  url: photo.url,
                  variation: photo.variation ?? null,
                })),
              }
            : undefined,
        },
        include: productInclude(),
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "PRODUCT_UPDATE",
          entityType: "Product",
          entityId: product.id,
        },
      });

      return withStockStatus(product);
    });
  } catch (error) {
    if (error instanceof ProductNotFoundError || error instanceof ProductRuleError) throw error;
    mapUniqueConflict(error);
  }
}

export async function updateProductStock(
  context: ProductAccessContext,
  productId: string,
  input: StockUpdateInput,
) {
  assertPermission(context.role, "inventory:write");

  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, organizationId: context.organizationId },
      include: { stock: true },
    });
    if (!product || !product.stock) throw new ProductNotFoundError();

    const quantity = input.quantity === undefined ? product.stock.quantity : new Prisma.Decimal(input.quantity);
    const minimum = input.minimum === undefined ? product.stock.minimum : new Prisma.Decimal(input.minimum);
    const maximum = input.maximum === undefined ? product.stock.maximum : new Prisma.Decimal(input.maximum);

    if (maximum.lt(minimum)) {
      throw new ProductRuleError("Estoque máximo deve ser maior ou igual ao estoque mínimo.");
    }

    const stock = await tx.productStock.update({
      where: { id: product.stock.id },
      data: { quantity, minimum, maximum },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PRODUCT_STOCK_UPDATE",
        entityType: "ProductStock",
        entityId: stock.id,
        metadata: {
          productId,
          quantity: stock.quantity.toFixed(3),
          minimum: stock.minimum.toFixed(3),
          maximum: stock.maximum.toFixed(3),
          lowStock: stock.quantity.lte(stock.minimum),
        },
      },
    });

    return {
      stock,
      lowStock: stock.quantity.lte(stock.minimum),
    };
  });
}

export async function listLowStockProducts(context: ProductAccessContext) {
  assertPermission(context.role, "inventory:read");

  const products = await db.product.findMany({
    where: { organizationId: context.organizationId },
    include: productInclude(),
    orderBy: { name: "asc" },
  });

  return products.filter((product) => product.stock && product.stock.quantity.lte(product.stock.minimum)).map(withStockStatus);
}

export async function ensureCatalogShare(context: ProductAccessContext) {
  assertPermission(context.role, "inventory:write");

  const existing = await db.catalogShare.findUnique({
    where: { organizationId: context.organizationId },
  });
  if (existing) return existing;

  const share = await db.catalogShare.create({
    data: {
      organizationId: context.organizationId,
      token: randomBytes(24).toString("base64url"),
    },
  });

  await db.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CATALOG_SHARE_CREATE",
      entityType: "CatalogShare",
      entityId: share.id,
    },
  });

  return share;
}

export async function getPublicCatalog(token: string) {
  const share = await db.catalogShare.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!share || share.organization.status !== "ACTIVE") return null;

  const products = await db.product.findMany({
    where: { organizationId: share.organizationId },
    include: {
      category: true,
      subcategory: true,
      photos: { orderBy: { createdAt: "asc" } },
      stock: true,
    },
    orderBy: { name: "asc" },
  });

  return {
    organization: {
      name: share.organization.name,
      slug: share.organization.slug,
    },
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      category: product.category.name,
      subcategory: product.subcategory?.name ?? null,
      brandManufacturer: product.brandManufacturer,
      description: product.description,
      technicalAttributes: product.technicalAttributes,
      photos: product.photos,
      salePrice: product.salePrice,
      unitMeasure: product.unitMeasure,
      stockAvailable: product.stock ? product.stock.quantity.gt(0) : false,
    })),
  };
}
