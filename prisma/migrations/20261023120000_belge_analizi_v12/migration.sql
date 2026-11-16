-- Belgelerden AI ile araç oluşturma V1.2: analiz işleri, belge denetim kaydı, belge özeti/sayfa/maske alanları,
-- ruhsat ek alanları ve belge inceleme durumu. Yalnızca ekleme ve NOT NULL kaldırma; mevcut veri silinmez.

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "docReview" TEXT,
ADD COLUMN     "firstRegistration" TEXT,
ADD COLUMN     "legalVinPartial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seats" INTEGER,
ADD COLUMN     "vehicleClass" TEXT;

-- AlterTable
ALTER TABLE "VehicleDocument" ADD COLUMN     "analysisId" TEXT,
ADD COLUMN     "masked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "page" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "quality" TEXT,
ADD COLUMN     "sha256" TEXT,
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DocAnalysis" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "mode" TEXT,
    "model" TEXT,
    "result" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAudit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "documentId" TEXT,
    "analysisId" TEXT,
    "vehicleId" TEXT,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocAnalysis_status_idx" ON "DocAnalysis"("status");

-- CreateIndex
CREATE INDEX "DocAnalysis_createdAt_idx" ON "DocAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentAudit_documentId_idx" ON "DocumentAudit"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAudit_createdAt_idx" ON "DocumentAudit"("createdAt");

-- CreateIndex
CREATE INDEX "VehicleDocument_analysisId_idx" ON "VehicleDocument"("analysisId");

-- CreateIndex
CREATE INDEX "VehicleDocument_sha256_idx" ON "VehicleDocument"("sha256");

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "DocAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocAnalysis" ADD CONSTRAINT "DocAnalysis_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocAnalysis" ADD CONSTRAINT "DocAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAudit" ADD CONSTRAINT "DocumentAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

