-- Additive Módulo 1 evolution; preserve existing customers and order data.
CREATE TABLE "Representative" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "whatsapp" TEXT,
  "commissionPercent" DECIMAL(5,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Representative_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Representative_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Representative_organizationId_name_idx" ON "Representative"("organizationId", "name");

ALTER TABLE "Client"
  ADD COLUMN "representativeId" TEXT,
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "priceTableKey" TEXT NOT NULL DEFAULT 'LOJA',
  ADD COLUMN "inactivityDaysOverride" INTEGER,
  ADD COLUMN "creditAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "creditMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Client" ADD CONSTRAINT "Client_representativeId_fkey"
  FOREIGN KEY ("representativeId") REFERENCES "Representative"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Client_organizationId_representativeId_idx" ON "Client"("organizationId", "representativeId");
CREATE INDEX "Client_organizationId_priceTableKey_idx" ON "Client"("organizationId", "priceTableKey");

ALTER TABLE "Client"
  ADD CONSTRAINT "client_inactivity_positive" CHECK (
    "inactivityDaysOverride" IS NULL OR "inactivityDaysOverride" > 0
  ),
  ADD CONSTRAINT "client_credit_methods_allowed" CHECK (
    "creditMethods" <@ ARRAY['BOLETO', 'CHEQUE', 'VALE']::TEXT[]
  ),
  ADD CONSTRAINT "client_credit_methods_approved" CHECK (
    "creditAllowed" OR cardinality("creditMethods") = 0
  );

ALTER TABLE "Representative" ADD CONSTRAINT "representative_commission_range" CHECK (
  "commissionPercent" IS NULL OR
  ("commissionPercent" >= 0 AND "commissionPercent" <= 100)
);

CREATE TRIGGER tenant_guard_client_representative
BEFORE INSERT OR UPDATE ON "Client"
FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Representative', 'representativeId');
