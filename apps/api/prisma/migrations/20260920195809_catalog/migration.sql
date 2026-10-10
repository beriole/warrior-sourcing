-- CreateEnum
CREATE TYPE "FreightRateUnit" AS ENUM ('KG', 'CBM');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TransportEase" AS ENUM ('EASY', 'MODERATE', 'DIFFICULT');

-- CreateEnum
CREATE TYPE "ProductBadge" AS ENUM ('LOW_MOQ', 'LIGHT_WEIGHT', 'SMALL_VOLUME', 'SAMPLE_AVAILABLE', 'CUSTOMIZABLE', 'VERIFIED_SUPPLIER', 'FRAGILE', 'BATTERY');

-- CreateEnum
CREATE TYPE "DataProvenance" AS ENUM ('VERIFIED', 'ESTIMATE', 'AI_SUGGESTION');

-- CreateTable
CREATE TABLE "forwarder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "cities" TEXT[],
    "modes" "ShippingMode"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forwarder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freight_rate" (
    "id" TEXT NOT NULL,
    "forwarderId" TEXT NOT NULL,
    "mode" "ShippingMode" NOT NULL,
    "unit" "FreightRateUnit" NOT NULL,
    "unitPriceXaf" INTEGER NOT NULL,
    "minimumChargeXaf" INTEGER NOT NULL DEFAULT 0,
    "weightBreakKg" INTEGER NOT NULL DEFAULT 0,
    "transitDays" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'XAF',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freight_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_simulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mode" "ShippingMode" NOT NULL,
    "forwarderId" TEXT,
    "quantity" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "totalXaf" INTEGER NOT NULL,
    "unitLandedCostXaf" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "InterestCategory" NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "purchasePriceMinor" INTEGER NOT NULL,
    "purchaseCurrency" "Currency" NOT NULL DEFAULT 'CNY',
    "purchasePriceXaf" INTEGER NOT NULL,
    "exchangeRate" DECIMAL(18,8) NOT NULL,
    "exchangeRateAt" TIMESTAMP(3) NOT NULL,
    "exchangeRateSource" TEXT NOT NULL,
    "moq" INTEGER NOT NULL,
    "weightGrams" INTEGER NOT NULL,
    "volumeCm3" INTEGER,
    "badges" "ProductBadge"[],
    "watchPoints" TEXT[],
    "supplierIds" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_market_data" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "localPriceMinXaf" INTEGER,
    "localPriceMaxXaf" INTEGER,
    "localPriceObservedAt" TIMESTAMP(3),
    "localPriceSource" TEXT,
    "localPriceProvenance" "DataProvenance" NOT NULL DEFAULT 'VERIFIED',
    "demand" "MarketLevel",
    "competition" "MarketLevel",
    "risk" "RiskLevel",
    "transportEase" "TransportEase",
    "capitalRequiredXaf" INTEGER,
    "assessedAt" TIMESTAMP(3),
    "assessmentSource" TEXT,
    "assessmentProvenance" "DataProvenance" NOT NULL DEFAULT 'ESTIMATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_market_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forwarder_active_idx" ON "forwarder"("active");

-- CreateIndex
CREATE INDEX "freight_rate_forwarderId_mode_effectiveFrom_idx" ON "freight_rate"("forwarderId", "mode", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "freight_rate_mode_active_idx" ON "freight_rate"("mode", "active");

-- CreateIndex
CREATE INDEX "import_simulation_userId_createdAt_idx" ON "import_simulation"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE INDEX "product_status_publishedAt_idx" ON "product"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "product_category_idx" ON "product"("category");

-- CreateIndex
CREATE INDEX "product_image_productId_position_idx" ON "product_image"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_market_data_productId_key" ON "product_market_data"("productId");

-- CreateIndex
CREATE INDEX "product_market_data_demand_idx" ON "product_market_data"("demand");

-- CreateIndex
CREATE INDEX "product_market_data_competition_idx" ON "product_market_data"("competition");

-- CreateIndex
CREATE INDEX "product_market_data_risk_idx" ON "product_market_data"("risk");

-- AddForeignKey
ALTER TABLE "freight_rate" ADD CONSTRAINT "freight_rate_forwarderId_fkey" FOREIGN KEY ("forwarderId") REFERENCES "forwarder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_simulation" ADD CONSTRAINT "import_simulation_forwarderId_fkey" FOREIGN KEY ("forwarderId") REFERENCES "forwarder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_market_data" ADD CONSTRAINT "product_market_data_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
