-- CreateEnum
CREATE TYPE "CoursePurchaseStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "coursePurchaseId" TEXT;

-- CreateTable
CREATE TABLE "course_purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "CoursePurchaseStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidXaf" INTEGER NOT NULL,
    "paymentReference" TEXT,
    "provisionCredentials" BOOLEAN NOT NULL DEFAULT false,
    "credentialsSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_purchase_userId_createdAt_idx" ON "course_purchase"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "course_purchase_courseId_status_idx" ON "course_purchase"("courseId", "status");

-- CreateIndex
CREATE INDEX "payment_coursePurchaseId_idx" ON "payment"("coursePurchaseId");

-- AddForeignKey
ALTER TABLE "course_purchase" ADD CONSTRAINT "course_purchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
