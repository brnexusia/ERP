-- CreateEnum
CREATE TYPE "SellerGoalMetric" AS ENUM ('REVENUE', 'SALES', 'CLIENTS');

-- CreateTable
CREATE TABLE "SellerGoal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sellerMembershipId" TEXT NOT NULL,
    "metric" "SellerGoalMetric" NOT NULL,
    "targetValue" DECIMAL(14,2) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerGoal_pkey" PRIMARY KEY ("id")
);

-- Constraints
ALTER TABLE "SellerGoal"
  ADD CONSTRAINT "SellerGoal_target_positive" CHECK ("targetValue" > 0);
ALTER TABLE "SellerGoal"
  ADD CONSTRAINT "SellerGoal_period_valid" CHECK ("endAt" >= "startAt");
ALTER TABLE "SellerGoal"
  ADD CONSTRAINT "SellerGoal_count_target_integer" CHECK (
    "metric" = 'REVENUE' OR "targetValue" = trunc("targetValue")
  );

-- CreateIndex
CREATE INDEX "SellerGoal_organizationId_sellerMembershipId_startAt_endAt_idx"
  ON "SellerGoal"("organizationId", "sellerMembershipId", "startAt", "endAt");
CREATE INDEX "SellerGoal_organizationId_metric_startAt_endAt_idx"
  ON "SellerGoal"("organizationId", "metric", "startAt", "endAt");

-- Foreign keys
ALTER TABLE "SellerGoal" ADD CONSTRAINT "SellerGoal_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerGoal" ADD CONSTRAINT "SellerGoal_sellerMembershipId_fkey"
  FOREIGN KEY ("sellerMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerGoal" ADD CONSTRAINT "SellerGoal_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth: a goal cannot point to a seller from another tenant,
-- and the creator must be a member of the same organization.
CREATE OR REPLACE FUNCTION tenant_guard_seller_goal()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Membership"
    WHERE "id" = NEW."sellerMembershipId"
      AND "organizationId" = NEW."organizationId"
      AND "role" = 'SELLER'
  ) THEN
    RAISE EXCEPTION 'seller goal tenant/role mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Membership"
    WHERE "userId" = NEW."createdByUserId"
      AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'seller goal creator tenant mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_guard_seller_goal
BEFORE INSERT OR UPDATE ON "SellerGoal"
FOR EACH ROW EXECUTE FUNCTION tenant_guard_seller_goal();
