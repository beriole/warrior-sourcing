-- AlterTable
ALTER TABLE "forwarder" ADD COLUMN     "warehouseAddressLatin" TEXT,
ADD COLUMN     "warehouseAddressZh" TEXT,
ADD COLUMN     "warehouseContactName" TEXT,
ADD COLUMN     "warehouseInstructions" TEXT,
ADD COLUMN     "warehouseName" TEXT,
ADD COLUMN     "warehousePhone" TEXT;
-- AlterTable
ALTER TABLE "importer_profile" ADD COLUMN     "clientCode" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "importer_profile_clientCode_key" ON "importer_profile"("clientCode");
