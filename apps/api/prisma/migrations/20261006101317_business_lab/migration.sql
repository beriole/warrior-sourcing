-- CreateTable
CREATE TABLE "business_project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capitalXaf" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "targetUnitPriceXaf" INTEGER NOT NULL,
    "orderReference" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sale" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceXaf" INTEGER NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_sale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_project_userId_startedAt_idx" ON "business_project"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "business_sale_projectId_soldAt_idx" ON "business_sale"("projectId", "soldAt" DESC);

-- AddForeignKey
ALTER TABLE "business_project" ADD CONSTRAINT "business_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sale" ADD CONSTRAINT "business_sale_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "business_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
