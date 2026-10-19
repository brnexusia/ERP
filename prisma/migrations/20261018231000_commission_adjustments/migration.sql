-- Commission corrections never overwrite the approved closing snapshot.
-- Only pending, unreconciled commission payables may be adjusted after approval.
CREATE TYPE "CommissionAdjustmentDirection" AS ENUM ('INCREASE', 'DECREASE');
CREATE TYPE "CommissionAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "CommissionAdjustment" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "closingId" TEXT NOT NULL,
 "status" "CommissionAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
 "direction" "CommissionAdjustmentDirection" NOT NULL,
 "amount" DECIMAL(14,2) NOT NULL,
 "reason" TEXT NOT NULL,
 "requestedByUserId" TEXT NOT NULL,
 "decidedByUserId" TEXT,
 "decisionReason" TEXT,
 "amountBefore" DECIMAL(14,2),
 "amountAfter" DECIMAL(14,2),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "decidedAt" TIMESTAMP(3),
 CONSTRAINT "CommissionAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CommissionAdjustment_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "CommissionClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CommissionAdjustment_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CommissionAdjustment_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "commission_adjustment_positive" CHECK ("amount" > 0),
 CONSTRAINT "commission_adjustment_reason" CHECK (length(trim("reason")) >= 8),
 CONSTRAINT "commission_adjustment_decision" CHECK (
    ("status" = 'PENDING' AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL AND "amountBefore" IS NULL AND "amountAfter" IS NULL)
    OR ("status" = 'REJECTED' AND "decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL AND "amountBefore" IS NULL AND "amountAfter" IS NULL)
    OR ("status" = 'APPROVED' AND "decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL AND "amountBefore" > 0 AND "amountAfter" > 0)
 )
);
CREATE INDEX "CommissionAdjustment_organizationId_closingId_createdAt_idx"
 ON "CommissionAdjustment"("organizationId","closingId","createdAt");
CREATE INDEX "CommissionAdjustment_organizationId_status_createdAt_idx"
 ON "CommissionAdjustment"("organizationId","status","createdAt");
CREATE UNIQUE INDEX "commission_adjustment_one_pending"
 ON "CommissionAdjustment"("closingId") WHERE "status" = 'PENDING';
CREATE TRIGGER tenant_guard_commission_adjustment
 BEFORE INSERT OR UPDATE ON "CommissionAdjustment"
 FOR EACH ROW EXECUTE FUNCTION erp_enforce_same_organization('CommissionClosing','closingId');
