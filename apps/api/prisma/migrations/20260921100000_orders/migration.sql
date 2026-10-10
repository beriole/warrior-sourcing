-- Lot ORD + PAY : lignes de commande, réception, précommandes, réconciliation des paiements.

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('STANDARD', 'PREORDER');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('WAREHOUSE_PICKUP', 'HOME_DELIVERY');

-- CreateEnum
CREATE TYPE "PreorderCampaignStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- DropIndex
DROP INDEX "order_userId_idx";

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "customsXaf" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'WAREHOUSE_PICKUP',
ADD COLUMN     "freightXaf" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "OrderKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "serviceFeeXaf" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
ADD COLUMN     "subtotalXaf" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "checkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payerPhone" TEXT,
ADD COLUMN     "providerLink" TEXT;

-- AlterTable
ALTER TABLE "payment_event" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'system';

-- CreateTable
CREATE TABLE "order_line" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productSlug" TEXT,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceXaf" INTEGER NOT NULL,
    "lineTotalXaf" INTEGER NOT NULL,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preorder_campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PreorderCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "productId" TEXT,
    "unitPriceXaf" INTEGER NOT NULL,
    "minimumQuantity" INTEGER NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "included" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excluded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leadTime" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "faq" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preorder_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_line_orderId_idx" ON "order_line"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "preorder_campaign_slug_key" ON "preorder_campaign"("slug");

-- CreateIndex
CREATE INDEX "preorder_campaign_status_endsAt_idx" ON "preorder_campaign"("status", "endsAt");

-- CreateIndex
CREATE INDEX "order_userId_createdAt_idx" ON "order"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "order_campaignId_status_idx" ON "order"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "preorder_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
