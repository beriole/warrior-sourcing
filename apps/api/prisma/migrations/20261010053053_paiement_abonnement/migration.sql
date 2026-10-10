-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "subscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "payment_subscriptionId_idx" ON "payment"("subscriptionId");
