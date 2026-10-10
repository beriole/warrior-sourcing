-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPENED', 'ANALYSIS', 'EVIDENCE', 'SUPPLIER_CONTACTED', 'PROPOSAL', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('NON_CONFORME', 'QUANTITE_MANQUANTE', 'CASSE', 'RETARD', 'NON_LIVRE', 'AUTRE');

-- CreateTable
CREATE TABLE "dispute" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "category" "DisputeCategory" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPENED',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "claimedAmountXaf" INTEGER NOT NULL DEFAULT 0,
    "resolvedAmountXaf" INTEGER,
    "openedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_event" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "fromStatus" "DisputeStatus",
    "toStatus" "DisputeStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispute_reference_key" ON "dispute"("reference");

-- CreateIndex
CREATE INDEX "dispute_status_createdAt_idx" ON "dispute"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "dispute_orderId_idx" ON "dispute"("orderId");

-- CreateIndex
CREATE INDEX "dispute_event_disputeId_createdAt_idx" ON "dispute_event"("disputeId", "createdAt");

-- AddForeignKey
ALTER TABLE "dispute_event" ADD CONSTRAINT "dispute_event_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
