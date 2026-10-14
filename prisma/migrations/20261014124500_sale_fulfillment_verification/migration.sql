-- Existing/legacy sales are unchanged. Newly created sales require independent
-- item verification before a delivery record may be created.
CREATE TYPE "FulfillmentStatus" AS ENUM ('SEPARATED', 'VERIFIED');

ALTER TABLE "Sale"
  ADD COLUMN "fulfillmentRequired" BOOLEAN NOT NULL DEFAULT true;

-- Mark only records present before the migration as legacy.
UPDATE "Sale" SET "fulfillmentRequired" = false;

CREATE TABLE "SaleFulfillment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "status" "FulfillmentStatus" NOT NULL,
  "separationItems" JSONB NOT NULL,
  "verificationItems" JSONB,
  "separatedByUserId" TEXT NOT NULL,
  "verifiedByUserId" TEXT,
  "separatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaleFulfillment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleFulfillment_saleId_key" UNIQUE ("saleId"),
  CONSTRAINT "SaleFulfillment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleFulfillment_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleFulfillment_separatedByUserId_fkey"
    FOREIGN KEY ("separatedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleFulfillment_verifiedByUserId_fkey"
    FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleFulfillment_different_verifier"
    CHECK ("verifiedByUserId" IS NULL OR "verifiedByUserId" <> "separatedByUserId"),
  CONSTRAINT "SaleFulfillment_verified_data"
    CHECK (
      ("status" = 'SEPARATED' AND "verifiedByUserId" IS NULL AND "verifiedAt" IS NULL AND "verificationItems" IS NULL)
      OR
      ("status" = 'VERIFIED' AND "verifiedByUserId" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "verificationItems" IS NOT NULL)
    )
);

CREATE INDEX "SaleFulfillment_organizationId_status_createdAt_idx"
  ON "SaleFulfillment" ("organizationId", "status", "createdAt");

CREATE TRIGGER tenant_guard_sale_fulfillment
  BEFORE INSERT OR UPDATE ON "SaleFulfillment"
  FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Sale', 'saleId');
