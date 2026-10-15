CREATE TYPE "ChequeRecoveryMethod" AS ENUM ('PIX','CASH','CARD','TRANSFER');
CREATE TABLE "SaleChequeReturn" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "salePaymentId" TEXT NOT NULL UNIQUE REFERENCES "SalePayment"("id") ON DELETE RESTRICT,
  "reason" TEXT NOT NULL,
  "returnedAt" TIMESTAMP(3) NOT NULL,
  "recordedByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SaleChequeReturn_organizationId_returnedAt_idx" ON "SaleChequeReturn"("organizationId","returnedAt");
CREATE TABLE "SaleChequeRecovery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "returnId" TEXT NOT NULL REFERENCES "SaleChequeReturn"("id") ON DELETE CASCADE,
  "method" "ChequeRecoveryMethod" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" > 0),
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "note" TEXT,
  "recordedByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SaleChequeRecovery_organizationId_returnId_receivedAt_idx" ON "SaleChequeRecovery"("organizationId","returnId","receivedAt");
CREATE TRIGGER tenant_guard_cheque_return BEFORE INSERT OR UPDATE ON "SaleChequeReturn" FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('SalePayment','salePaymentId');
CREATE TRIGGER tenant_guard_cheque_recovery BEFORE INSERT OR UPDATE ON "SaleChequeRecovery" FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('SaleChequeReturn','returnId');
