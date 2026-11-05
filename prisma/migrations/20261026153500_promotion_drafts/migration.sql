-- Administrative-only promotional drafts. Nothing in this table changes price or sales.
CREATE TYPE "PromotionDraftKind" AS ENUM (
  'PRODUCT', 'CATEGORY', 'PROGRESSIVE_VALUE', 'PROGRESSIVE_QUANTITY'
);

CREATE TABLE "PromotionDraft" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "PromotionDraftKind" NOT NULL,
  "productId" TEXT,
  "categoryId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionDraft_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PromotionDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PromotionDraft_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PromotionDraft_categoryId_fkey" FOREIGN KEY ("categoryId")
    REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "promotion_draft_name_nonblank" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "promotion_draft_scope" CHECK (
    ("kind" = 'PRODUCT' AND "productId" IS NOT NULL AND "categoryId" IS NULL) OR
    ("kind" = 'CATEGORY' AND "categoryId" IS NOT NULL AND "productId" IS NULL) OR
    ("kind" IN ('PROGRESSIVE_VALUE','PROGRESSIVE_QUANTITY')
      AND "productId" IS NULL AND "categoryId" IS NULL)
  )
);

CREATE INDEX "PromotionDraft_organizationId_kind_createdAt_idx"
  ON "PromotionDraft"("organizationId", "kind", "createdAt");
CREATE INDEX "PromotionDraft_organizationId_productId_idx"
  ON "PromotionDraft"("organizationId", "productId");
CREATE INDEX "PromotionDraft_organizationId_categoryId_idx"
  ON "PromotionDraft"("organizationId", "categoryId");

-- The pre-existing DB function prevents direct-write cross-tenant joins as well.
CREATE TRIGGER tenant_guard_promotion_product
  BEFORE INSERT OR UPDATE ON "PromotionDraft"
  FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Product', 'productId');

CREATE TRIGGER tenant_guard_promotion_category
  BEFORE INSERT OR UPDATE ON "PromotionDraft"
  FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ProductCategory', 'categoryId');

-- An author must belong to the draft's tenant; foreign keys to User alone
-- do not express this multi-tenant invariant.
CREATE OR REPLACE FUNCTION erp_enforce_promotion_creator_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Membership"
    WHERE "organizationId" = NEW."organizationId"
      AND "userId" = NEW."createdByUserId"
  ) THEN
    RAISE EXCEPTION 'promotion creator not a member of organization %', NEW."organizationId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_guard_promotion_creator
  BEFORE INSERT OR UPDATE ON "PromotionDraft"
  FOR EACH ROW EXECUTE FUNCTION erp_enforce_promotion_creator_membership();
