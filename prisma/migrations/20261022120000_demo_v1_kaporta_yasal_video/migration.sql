-- Demo V1: kaporta şeması (VehiclePart), yasal ilan alanları, video onayı, eksik bilgiyle taslak.
-- Yalnızca ekleme ve NOT NULL kaldırma içerir; mevcut veri silinmez.

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "bodyVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "changedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "damageRecord" TEXT,
ADD COLUMN     "legalLien" TEXT,
ADD COLUMN     "legalRegisteredToCompany" BOOLEAN,
ADD COLUMN     "legalWarranty" TEXT,
ADD COLUMN     "localPaintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paintedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoPublic" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "brand" DROP NOT NULL,
ALTER COLUMN "model" DROP NOT NULL,
ALTER COLUMN "year" DROP NOT NULL,
ALTER COLUMN "km" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "fuel" DROP NOT NULL,
ALTER COLUMN "transmission" DROP NOT NULL,
ALTER COLUMN "bodyType" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VehiclePart" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "reportState" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePart_vehicleId_part_key" ON "VehiclePart"("vehicleId", "part");

-- AddForeignKey
ALTER TABLE "VehiclePart" ADD CONSTRAINT "VehiclePart_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePart" ADD CONSTRAINT "VehiclePart_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Önceden CRM'den elle yüklenen videolar zaten müşteriye açıktı; bu davranış korunur.
-- AI akışından gelen (analiz) videoları onay bekler.
UPDATE "Vehicle" SET "videoPublic" = true WHERE "videoPath" IS NOT NULL AND "aiDraftMode" IS NULL;
