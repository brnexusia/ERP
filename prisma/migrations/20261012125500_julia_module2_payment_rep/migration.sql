ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CASH';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VALE';

ALTER TABLE "Sale"
  ADD COLUMN "representativeId" TEXT,
  ADD COLUMN "representativeRate" DECIMAL(5,2);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_representativeId_fkey"
  FOREIGN KEY ("representativeId") REFERENCES "Representative"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sale_organizationId_representativeId_createdAt_idx"
  ON "Sale"("organizationId", "representativeId", "createdAt");

ALTER TABLE "Sale" ADD CONSTRAINT "sale_representative_rate_range" CHECK (
  "representativeRate" IS NULL OR
  ("representativeRate" >= 0 AND "representativeRate" <= 100)
);

ALTER TABLE "SalePayment"
  ADD COLUMN "chequeBank" TEXT,
  ADD COLUMN "chequeNumber" TEXT,
  ADD COLUMN "chequeHolder" TEXT,
  ADD COLUMN "chequeDepositAt" TIMESTAMP(3);
CREATE INDEX "SalePayment_organizationId_chequeNumber_idx"
  ON "SalePayment"("organizationId", "chequeNumber");

CREATE TRIGGER tenant_guard_sale_representative
BEFORE INSERT OR UPDATE ON "Sale"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Representative', 'representativeId');
