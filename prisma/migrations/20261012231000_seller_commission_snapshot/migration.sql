-- Additive: no retroactive commission calculated for historical orders.
ALTER TABLE "Membership"
  ADD COLUMN "commissionPercent" DECIMAL(5,2);
ALTER TABLE "Sale"
  ADD COLUMN "sellerCommissionRate" DECIMAL(5,2);
ALTER TABLE "Membership" ADD CONSTRAINT "seller_commission_percent_range" CHECK (
  "commissionPercent" IS NULL OR
  ("commissionPercent" >= 0 AND "commissionPercent" <= 100)
);
ALTER TABLE "Sale" ADD CONSTRAINT "sale_seller_commission_rate_range" CHECK (
  "sellerCommissionRate" IS NULL OR
  ("sellerCommissionRate" >= 0 AND "sellerCommissionRate" <= 100)
);
