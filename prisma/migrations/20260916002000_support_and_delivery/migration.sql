-- CreateEnum
CREATE TYPE "SupportKind" AS ENUM ('ATTENDANCE', 'AFTER_SALES', 'COMPLAINT', 'SAC');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'CORREIOS', 'CARRIER');

-- CreateTable
CREATE TABLE "SupportRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" TEXT,
    "kind" "SupportKind" NOT NULL,
    "content" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "DeliveryMethod" NOT NULL,
    "pickupRegisteredAt" TIMESTAMP(3),
    "trackingCode" TEXT,
    "carrierName" TEXT,
    "shipmentProofUrl" TEXT,
    "deliveryProofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRecord_organizationId_clientId_createdAt_idx" ON "SupportRecord"("organizationId", "clientId", "createdAt");
CREATE INDEX "SupportRecord_organizationId_saleId_createdAt_idx" ON "SupportRecord"("organizationId", "saleId", "createdAt");
CREATE INDEX "SupportRecord_organizationId_kind_createdAt_idx" ON "SupportRecord"("organizationId", "kind", "createdAt");
CREATE UNIQUE INDEX "SaleDelivery_saleId_key" ON "SaleDelivery"("saleId");
CREATE INDEX "SaleDelivery_organizationId_method_createdAt_idx" ON "SaleDelivery"("organizationId", "method", "createdAt");
CREATE INDEX "SaleDelivery_organizationId_trackingCode_idx" ON "SaleDelivery"("organizationId", "trackingCode");

-- Foreign keys
ALTER TABLE "SupportRecord" ADD CONSTRAINT "SupportRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRecord" ADD CONSTRAINT "SupportRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRecord" ADD CONSTRAINT "SupportRecord_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportRecord" ADD CONSTRAINT "SupportRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleDelivery" ADD CONSTRAINT "SaleDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleDelivery" ADD CONSTRAINT "SaleDelivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
