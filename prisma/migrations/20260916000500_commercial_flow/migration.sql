-- CreateEnum
CREATE TYPE "SaleStage" AS ENUM ('QUOTE', 'ORDER', 'PAID');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('WHATSAPP', 'SITE', 'PHYSICAL_STORE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'PIX', 'BOLETO', 'CHEQUE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "responsibleSellerMembershipId" TEXT;

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerMembershipId" TEXT NOT NULL,
    "stage" "SaleStage" NOT NULL DEFAULT 'QUOTE',
    "channel" "SalesChannel" NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Client_organizationId_responsibleSellerMembershipId_idx" ON "Client"("organizationId", "responsibleSellerMembershipId");
CREATE INDEX "Sale_organizationId_stage_createdAt_idx" ON "Sale"("organizationId", "stage", "createdAt");
CREATE INDEX "Sale_organizationId_clientId_createdAt_idx" ON "Sale"("organizationId", "clientId", "createdAt");
CREATE INDEX "Sale_organizationId_sellerMembershipId_createdAt_idx" ON "Sale"("organizationId", "sellerMembershipId", "createdAt");
CREATE INDEX "Sale_organizationId_channel_createdAt_idx" ON "Sale"("organizationId", "channel", "createdAt");
CREATE INDEX "SaleItem_organizationId_saleId_idx" ON "SaleItem"("organizationId", "saleId");
CREATE INDEX "SaleItem_organizationId_productId_createdAt_idx" ON "SaleItem"("organizationId", "productId", "createdAt");
CREATE INDEX "SalePayment_organizationId_saleId_createdAt_idx" ON "SalePayment"("organizationId", "saleId", "createdAt");
CREATE INDEX "SalePayment_organizationId_method_createdAt_idx" ON "SalePayment"("organizationId", "method", "createdAt");
CREATE INDEX "SalePayment_organizationId_status_dueDate_idx" ON "SalePayment"("organizationId", "status", "dueDate");

-- Data invariants
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_totalAmount_nonnegative" CHECK ("totalAmount" >= 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_stage_dates_consistent" CHECK (
  ("stage" = 'QUOTE' AND "orderedAt" IS NULL AND "paidAt" IS NULL)
  OR ("stage" = 'ORDER' AND "orderedAt" IS NOT NULL AND "paidAt" IS NULL)
  OR ("stage" = 'PAID' AND "orderedAt" IS NOT NULL AND "paidAt" IS NOT NULL)
);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_lineTotal_nonnegative" CHECK ("lineTotal" >= 0);
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_status_settlement_consistent" CHECK (
  ("status" = 'PENDING' AND "settledAt" IS NULL)
  OR ("status" = 'PAID' AND "settledAt" IS NOT NULL)
);

-- Foreign keys
ALTER TABLE "Client" ADD CONSTRAINT "Client_responsibleSellerMembershipId_fkey" FOREIGN KEY ("responsibleSellerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerMembershipId_fkey" FOREIGN KEY ("sellerMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
