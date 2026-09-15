-- AlterTable
ALTER TABLE "Client" ADD COLUMN "segmentId" TEXT;

-- CreateTable
CREATE TABLE "ClientSegment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCreditAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "usedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCreditMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountDelta" DECIMAL(14,2) NOT NULL,
    "usedBefore" DECIMAL(14,2) NOT NULL,
    "usedAfter" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCreditMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientValeAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientValeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientValeMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountDelta" DECIMAL(14,2) NOT NULL,
    "balanceBefore" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientValeMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCrmEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followUpAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCrmEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientModuleSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inactivityDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientModuleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSegment_organizationId_name_key" ON "ClientSegment"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ClientSegment_organizationId_name_idx" ON "ClientSegment"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCreditAccount_clientId_key" ON "ClientCreditAccount"("clientId");

-- CreateIndex
CREATE INDEX "ClientCreditAccount_organizationId_clientId_idx" ON "ClientCreditAccount"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "ClientCreditMovement_organizationId_clientId_createdAt_idx" ON "ClientCreditMovement"("organizationId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientCreditMovement_organizationId_accountId_createdAt_idx" ON "ClientCreditMovement"("organizationId", "accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientValeAccount_clientId_key" ON "ClientValeAccount"("clientId");

-- CreateIndex
CREATE INDEX "ClientValeAccount_organizationId_clientId_idx" ON "ClientValeAccount"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "ClientValeMovement_organizationId_clientId_createdAt_idx" ON "ClientValeMovement"("organizationId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientValeMovement_organizationId_accountId_createdAt_idx" ON "ClientValeMovement"("organizationId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientCrmEntry_organizationId_clientId_occurredAt_idx" ON "ClientCrmEntry"("organizationId", "clientId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClientCrmEntry_organizationId_followUpAt_idx" ON "ClientCrmEntry"("organizationId", "followUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientModuleSettings_organizationId_key" ON "ClientModuleSettings"("organizationId");

-- CreateIndex
CREATE INDEX "Client_organizationId_segmentId_idx" ON "Client"("organizationId", "segmentId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "ClientSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSegment" ADD CONSTRAINT "ClientSegment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditAccount" ADD CONSTRAINT "ClientCreditAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditAccount" ADD CONSTRAINT "ClientCreditAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditMovement" ADD CONSTRAINT "ClientCreditMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditMovement" ADD CONSTRAINT "ClientCreditMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditMovement" ADD CONSTRAINT "ClientCreditMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientCreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditMovement" ADD CONSTRAINT "ClientCreditMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientValeAccount" ADD CONSTRAINT "ClientValeAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientValeAccount" ADD CONSTRAINT "ClientValeAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientValeMovement" ADD CONSTRAINT "ClientValeMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientValeMovement" ADD CONSTRAINT "ClientValeMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientValeMovement" ADD CONSTRAINT "ClientValeMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientValeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientValeMovement" ADD CONSTRAINT "ClientValeMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCrmEntry" ADD CONSTRAINT "ClientCrmEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCrmEntry" ADD CONSTRAINT "ClientCrmEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCrmEntry" ADD CONSTRAINT "ClientCrmEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientModuleSettings" ADD CONSTRAINT "ClientModuleSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
