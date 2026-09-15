-- CreateEnum
CREATE TYPE "BankEntryDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable
CREATE TABLE "AccountPayable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "direction" "BankEntryDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bankEntryId" TEXT NOT NULL,
    "salePaymentId" TEXT,
    "accountPayableId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- Constraints
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_paid_state_consistent" CHECK (("status" = 'PAID' AND "paidAt" IS NOT NULL) OR ("status" = 'PENDING' AND "paidAt" IS NULL));
ALTER TABLE "BankStatementEntry" ADD CONSTRAINT "BankStatementEntry_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_single_target" CHECK ((("salePaymentId" IS NOT NULL)::int + ("accountPayableId" IS NOT NULL)::int) = 1);

-- CreateIndex
CREATE INDEX "AccountPayable_organizationId_status_dueDate_idx" ON "AccountPayable"("organizationId", "status", "dueDate");
CREATE INDEX "AccountPayable_organizationId_paidAt_idx" ON "AccountPayable"("organizationId", "paidAt");
CREATE INDEX "BankStatementEntry_organizationId_occurredAt_idx" ON "BankStatementEntry"("organizationId", "occurredAt");
CREATE INDEX "BankStatementEntry_organizationId_direction_occurredAt_idx" ON "BankStatementEntry"("organizationId", "direction", "occurredAt");
CREATE INDEX "BankStatementEntry_organizationId_reference_idx" ON "BankStatementEntry"("organizationId", "reference");
CREATE INDEX "BankReconciliation_organizationId_bankEntryId_reconciledAt_idx" ON "BankReconciliation"("organizationId", "bankEntryId", "reconciledAt");
CREATE INDEX "BankReconciliation_organizationId_salePaymentId_reconciledAt_idx" ON "BankReconciliation"("organizationId", "salePaymentId", "reconciledAt");
CREATE INDEX "BankReconciliation_organizationId_accountPayableId_reconciledAt_idx" ON "BankReconciliation"("organizationId", "accountPayableId", "reconciledAt");

-- Foreign keys
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankStatementEntry" ADD CONSTRAINT "BankStatementEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankEntryId_fkey" FOREIGN KEY ("bankEntryId") REFERENCES "BankStatementEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_salePaymentId_fkey" FOREIGN KEY ("salePaymentId") REFERENCES "SalePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_accountPayableId_fkey" FOREIGN KEY ("accountPayableId") REFERENCES "AccountPayable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
