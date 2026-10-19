-- Snapshot-only commission closings, one payable per beneficiary/competence source.
-- Existing previews and account payables remain unchanged.
CREATE TYPE "CommissionRecipientKind" AS ENUM ('SELLER','REPRESENTATIVE');
CREATE TABLE "CommissionClosing" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "month" TEXT NOT NULL,
  "kind" "CommissionRecipientKind" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "beneficiaryId" TEXT NOT NULL,
  "beneficiaryName" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" > 0),
  "dueDate" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "payableId" TEXT NOT NULL UNIQUE REFERENCES "AccountPayable"("id") ON DELETE RESTRICT,
  "approvedByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_unique_source" UNIQUE ("organizationId","month","kind","sourceId"),
  CONSTRAINT "commission_month_valid" CHECK ("month" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);
CREATE INDEX "CommissionClosing_organizationId_month_kind_idx"
  ON "CommissionClosing"("organizationId","month","kind");
CREATE TRIGGER tenant_guard_commission_payable BEFORE INSERT OR UPDATE
  ON "CommissionClosing" FOR EACH ROW
  EXECUTE FUNCTION erp_enforce_same_organization('AccountPayable','payableId');
