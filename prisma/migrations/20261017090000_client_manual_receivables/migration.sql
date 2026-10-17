-- Additive independent receivables: never duplicates Sale/SalePayment records.
CREATE TYPE "ManualReceiptMethod" AS ENUM ('PIX','CASH','CARD','TRANSFER');
CREATE TABLE "ClientManualReceivable" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE RESTRICT,
  "sourceReference" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" > 0),
  "dueDate" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manual_receivable_reference_unique" UNIQUE ("organizationId","sourceReference"),
  CONSTRAINT "manual_receivable_description_nonblank" CHECK (length(trim("description")) >= 5),
  CONSTRAINT "manual_receivable_reference_nonblank" CHECK (length(trim("sourceReference")) >= 4)
);
CREATE INDEX "ClientManualReceivable_organizationId_clientId_dueDate_idx"
 ON "ClientManualReceivable"("organizationId","clientId","dueDate");
CREATE TABLE "ClientManualReceipt" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "receivableId" TEXT NOT NULL REFERENCES "ClientManualReceivable"("id") ON DELETE RESTRICT,
  "method" "ManualReceiptMethod" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" > 0),
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "note" TEXT,
  "recordedByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ClientManualReceipt_organizationId_receivableId_receivedAt_idx"
 ON "ClientManualReceipt"("organizationId","receivableId","receivedAt");
CREATE TRIGGER tenant_guard_manual_receivable
  BEFORE INSERT OR UPDATE ON "ClientManualReceivable"
  FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('Client','clientId');
CREATE TRIGGER tenant_guard_manual_receipt
  BEFORE INSERT OR UPDATE ON "ClientManualReceipt"
  FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('ClientManualReceivable','receivableId');
