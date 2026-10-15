-- Additive: historic orders keep existing gross=net amounts.
CREATE TYPE "DiscountApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Sale"
  ADD COLUMN "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale"
  ADD CONSTRAINT "sale_discount_nonnegative" CHECK ("discountAmount" >= 0 AND "discountAmount" < "totalAmount" OR "discountAmount" = 0);

CREATE TABLE "SaleDiscountRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "status" "DiscountApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "percent" DECIMAL(5,2) NOT NULL,
  "baseAmount" DECIMAL(14,2) NOT NULL,
  "discountAmount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "decidedByUserId" TEXT,
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "SaleDiscountRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleDiscountRequest_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleDiscountRequest_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleDiscountRequest_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleDiscountRequest_decidedByUserId_fkey"
    FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "discount_percent_range" CHECK ("percent" > 0 AND "percent" < 100),
  CONSTRAINT "discount_amount_positive" CHECK ("discountAmount" > 0 AND "discountAmount" < "baseAmount"),
  CONSTRAINT "discount_decision_integrity" CHECK (
    ("status" = 'PENDING' AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL)
    OR ("status" <> 'PENDING' AND "decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL)
  )
);
CREATE INDEX "SaleDiscountRequest_organizationId_saleId_createdAt_idx"
  ON "SaleDiscountRequest"("organizationId", "saleId", "createdAt");
CREATE INDEX "SaleDiscountRequest_organizationId_status_createdAt_idx"
  ON "SaleDiscountRequest"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "sale_discount_one_pending_or_approved"
  ON "SaleDiscountRequest"("saleId")
  WHERE "status" IN ('PENDING', 'APPROVED');

CREATE TRIGGER tenant_guard_sale_discount
BEFORE INSERT OR UPDATE ON "SaleDiscountRequest"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Sale', 'saleId');
