-- CreateEnum
CREATE TYPE "SupplierShopPlatform" AS ENUM ('ALIBABA', 'C1688', 'MADE_IN_CHINA', 'GLOBAL_SOURCES', 'DHGATE', 'TAOBAO', 'WEBSITE', 'OTHER');

-- AlterTable
ALTER TABLE "supplier" ADD COLUMN     "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "supplier_shop_link" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "platform" "SupplierShopPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "checkedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_shop_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_shop_link_supplierId_position_idx" ON "supplier_shop_link"("supplierId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_shop_link_supplierId_url_key" ON "supplier_shop_link"("supplierId", "url");

-- AddForeignKey
ALTER TABLE "supplier_shop_link" ADD CONSTRAINT "supplier_shop_link_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
