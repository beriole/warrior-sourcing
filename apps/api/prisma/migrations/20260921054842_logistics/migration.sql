
-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('COMPLIANT', 'WITH_RESERVATIONS', 'NON_COMPLIANT');

-- AlterTable
ALTER TABLE "shipment_event" ADD COLUMN     "inspectionId" TEXT,
ADD COLUMN     "previousStage" "ShipmentStage",
ADD COLUMN     "proofUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "recordedByName" TEXT,
ADD COLUMN     "rollbackReason" TEXT;

-- CreateTable
CREATE TABLE "parcel" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_report" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "quantityExpected" INTEGER,
    "quantityReceived" INTEGER,
    "defects" TEXT,
    "packaging" TEXT,
    "measurements" TEXT,
    "weightGrams" INTEGER,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,
    "notes" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL,
    "inspectedById" TEXT,
    "inspectedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parcel_orderId_key" ON "parcel"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "parcel_code_key" ON "parcel"("code");

-- CreateIndex
CREATE INDEX "inspection_report_orderId_inspectedAt_idx" ON "inspection_report"("orderId", "inspectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_event_inspectionId_key" ON "shipment_event"("inspectionId");

-- CreateIndex
CREATE INDEX "shipment_event_stage_idx" ON "shipment_event"("stage");

-- AddForeignKey
ALTER TABLE "shipment_event" ADD CONSTRAINT "shipment_event_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspection_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

