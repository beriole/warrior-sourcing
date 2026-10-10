-- CreateEnum
CREATE TYPE "SupplierFactoryScale" AS ENUM ('WORKSHOP', 'SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "SupplierDocumentKind" AS ENUM ('BUSINESS_LICENSE', 'EXPORT_LICENSE', 'CERTIFICATION', 'FACTORY_AUDIT', 'QUALITY_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierIncidentSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SupplierIncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupplierPhotoKind" AS ENUM ('FACTORY', 'PRODUCTION_LINE', 'WAREHOUSE', 'SAMPLE', 'PACKAGING', 'TEAM');

-- CreateEnum
CREATE TYPE "SupplierPaymentTerm" AS ENUM ('FULL_PREPAYMENT', 'DEPOSIT_30_70', 'DEPOSIT_50_50', 'ON_DELIVERY', 'ESCROW');

-- CreateEnum
CREATE TYPE "SupplierTestOrderOutcome" AS ENUM ('CONFORMING', 'RESERVATION', 'NON_CONFORMING');

-- CreateEnum
CREATE TYPE "SupplierRequestKind" AS ENUM ('QUOTE', 'SOURCING');

-- CreateEnum
CREATE TYPE "SupplierRequestStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "supplier_profile" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "foundedYear" INTEGER,
    "employeeCount" INTEGER,
    "factoryScale" "SupplierFactoryScale",
    "productionLines" INTEGER,
    "monthlyCapacity" INTEGER,
    "ownsFactory" BOOLEAN NOT NULL DEFAULT false,
    "exportExperienceYears" INTEGER,
    "province" TEXT,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mainMarkets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseTimeHours" INTEGER,
    "presentation" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_offering" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InterestCategory" NOT NULL,
    "description" TEXT,
    "unitPriceCnyMinor" INTEGER,
    "priceObservedAt" TIMESTAMP(3),
    "moq" INTEGER,
    "customizable" BOOLEAN NOT NULL DEFAULT false,
    "sampleAvailable" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_terms" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "minOrderValueCnyMinor" INTEGER,
    "paymentTerms" "SupplierPaymentTerm"[] DEFAULT ARRAY[]::"SupplierPaymentTerm"[],
    "depositPercent" INTEGER,
    "sampleAvailable" BOOLEAN NOT NULL DEFAULT false,
    "sampleCostCnyMinor" INTEGER,
    "sampleLeadTimeDays" INTEGER,
    "customizationOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "packagingOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "incoterms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productionLeadTimeDays" INTEGER,
    "negotiable" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_document" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "kind" "SupplierDocumentKind" NOT NULL,
    "label" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_incident" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "severity" "SupplierIncidentSeverity" NOT NULL,
    "status" "SupplierIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "orderReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_test_order" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "productLabel" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountCnyMinor" INTEGER NOT NULL,
    "outcome" "SupplierTestOrderOutcome" NOT NULL,
    "inspectionReportUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_test_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_photo" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "kind" "SupplierPhotoKind" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "takenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contact" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "wechat" TEXT,
    "email" TEXT,
    "website" TEXT,
    "storeUrl" TEXT,
    "addressLine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contact_access" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_contact_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_level_change" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fromLevel" "SupplierVerificationLevel",
    "toLevel" "SupplierVerificationLevel" NOT NULL,
    "verificationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_level_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_request" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SupplierRequestKind" NOT NULL,
    "status" "SupplierRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "productLabel" TEXT NOT NULL,
    "quantity" INTEGER,
    "budgetXafMinor" INTEGER,
    "city" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_profile_supplierId_key" ON "supplier_profile"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_offering_supplierId_idx" ON "supplier_offering"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_offering_category_idx" ON "supplier_offering"("category");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_terms_supplierId_key" ON "supplier_terms"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_document_supplierId_idx" ON "supplier_document"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_incident_supplierId_occurredAt_idx" ON "supplier_incident"("supplierId", "occurredAt");

-- CreateIndex
CREATE INDEX "supplier_test_order_supplierId_orderedAt_idx" ON "supplier_test_order"("supplierId", "orderedAt");

-- CreateIndex
CREATE INDEX "supplier_photo_supplierId_idx" ON "supplier_photo"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_contact_supplierId_key" ON "supplier_contact"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_contact_access_supplierId_accessedAt_idx" ON "supplier_contact_access"("supplierId", "accessedAt");

-- CreateIndex
CREATE INDEX "supplier_contact_access_userId_idx" ON "supplier_contact_access"("userId");

-- CreateIndex
CREATE INDEX "supplier_level_change_supplierId_decidedAt_idx" ON "supplier_level_change"("supplierId", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_request_reference_key" ON "supplier_request"("reference");

-- CreateIndex
CREATE INDEX "supplier_request_supplierId_idx" ON "supplier_request"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_request_userId_createdAt_idx" ON "supplier_request"("userId", "createdAt");
