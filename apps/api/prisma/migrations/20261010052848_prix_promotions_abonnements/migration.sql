-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('PERCENTAGE', 'AMOUNT', 'FIXED_PRICE', 'FREE');

-- CreateEnum
CREATE TYPE "PromotionTarget" AS ENUM ('COURSE', 'COURSE_THEME', 'ALL_COURSES', 'PLAN', 'ALL_PLANS');

-- CreateEnum
CREATE TYPE "PromotionTrigger" AS ENUM ('AUTOMATIC', 'CODE');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionRight" AS ENUM ('SUPPLIER_CONTACTS', 'ACADEMY_INCLUDED', 'PRIORITY_SUPPORT', 'UNLIMITED_SAVED_CALCULATIONS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "DiscountKind" NOT NULL,
    "percentage" INTEGER,
    "amountXaf" INTEGER,
    "target" "PromotionTarget" NOT NULL,
    "targetId" TEXT,
    "trigger" "PromotionTrigger" NOT NULL DEFAULT 'AUTOMATIC',
    "code" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "firstPurchaseOnly" BOOLEAN NOT NULL DEFAULT false,
    "minimumAmountXaf" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_redemption" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "discountXaf" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "priceXaf" INTEGER NOT NULL,
    "period" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "rights" "SubscriptionRight"[],
    "serviceDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidXaf" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_code_key" ON "promotion"("code");

-- CreateIndex
CREATE INDEX "promotion_active_startsAt_endsAt_idx" ON "promotion"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "promotion_target_targetId_idx" ON "promotion"("target", "targetId");

-- CreateIndex
CREATE INDEX "promotion_redemption_promotionId_userId_idx" ON "promotion_redemption"("promotionId", "userId");

-- CreateIndex
CREATE INDEX "promotion_redemption_userId_createdAt_idx" ON "promotion_redemption"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_slug_key" ON "subscription_plan"("slug");

-- CreateIndex
CREATE INDEX "subscription_plan_active_position_idx" ON "subscription_plan"("active", "position");

-- CreateIndex
CREATE INDEX "subscription_userId_endsAt_idx" ON "subscription"("userId", "endsAt" DESC);

-- CreateIndex
CREATE INDEX "subscription_status_endsAt_idx" ON "subscription"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
