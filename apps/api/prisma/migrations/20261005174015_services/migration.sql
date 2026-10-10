-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('SUPPLIER_SEARCH', 'VERIFICATION', 'INSPECTION', 'NEGOTIATION', 'ASSISTED_PURCHASE', 'SUPPLIER_PAYMENT', 'CONSOLIDATION', 'SHIPPING', 'BRANDING', 'COACHING');

-- CreateEnum
CREATE TYPE "ServicePricingMode" AS ENUM ('FIXED', 'FROM', 'QUOTE');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'AWAITING_CLIENT', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "serviceOrderId" TEXT;

-- CreateTable
CREATE TABLE "service_offering" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "pricingMode" "ServicePricingMode" NOT NULL DEFAULT 'FIXED',
    "priceXaf" INTEGER,
    "leadTimeDays" INTEGER,
    "leadTimeNote" TEXT,
    "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "amountXaf" INTEGER NOT NULL,
    "leadTimeDays" INTEGER,
    "orderedDeliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brief" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "quantity" INTEGER,
    "budgetXaf" INTEGER,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_event" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "fromStatus" "ServiceOrderStatus",
    "toStatus" "ServiceOrderStatus" NOT NULL,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_deliverable" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_offering_slug_key" ON "service_offering"("slug");

-- CreateIndex
CREATE INDEX "service_offering_publishedAt_position_idx" ON "service_offering"("publishedAt", "position");

-- CreateIndex
CREATE INDEX "service_offering_category_idx" ON "service_offering"("category");

-- CreateIndex
CREATE UNIQUE INDEX "service_order_reference_key" ON "service_order"("reference");

-- CreateIndex
CREATE INDEX "service_order_userId_createdAt_idx" ON "service_order"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "service_order_status_createdAt_idx" ON "service_order"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "service_order_paymentReference_idx" ON "service_order"("paymentReference");

-- CreateIndex
CREATE INDEX "service_order_event_serviceOrderId_createdAt_idx" ON "service_order_event"("serviceOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "service_deliverable_serviceOrderId_createdAt_idx" ON "service_deliverable"("serviceOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_serviceOrderId_idx" ON "payment"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service_offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_event" ADD CONSTRAINT "service_order_event_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_deliverable" ADD CONSTRAINT "service_deliverable_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
