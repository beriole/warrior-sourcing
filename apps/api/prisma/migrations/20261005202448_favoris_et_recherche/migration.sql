-- Recherche globale (PLAT-08, §36).
--
-- `unaccent` retire les accents : « telefone » doit pouvoir trouver « téléphone ».
-- `pg_trgm` mesure la ressemblance entre deux chaînes par trigrammes, ce qui tolère
-- une faute de frappe sans dictionnaire ni liste de synonymes à tenir à jour.
--
-- Les deux extensions sont créées ici parce qu'elles conditionnent la requête de
-- recherche : sans elles, l'API renverrait une erreur SQL à la première recherche.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "FavoriteTargetType" AS ENUM ('PRODUCT', 'SUPPLIER', 'COURSE', 'SERVICE');

-- CreateTable
CREATE TABLE "favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "FavoriteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_userId_createdAt_idx" ON "favorite"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "favorite_userId_targetType_targetId_key" ON "favorite"("userId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
