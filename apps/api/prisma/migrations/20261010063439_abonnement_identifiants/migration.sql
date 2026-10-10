-- AlterTable
ALTER TABLE "subscription" ADD COLUMN     "credentialsSentAt" TIMESTAMP(3),
ADD COLUMN     "provisionCredentials" BOOLEAN NOT NULL DEFAULT false;
