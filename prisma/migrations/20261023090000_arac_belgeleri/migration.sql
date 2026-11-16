-- Araç belgeleri (ruhsat / ekspertiz raporu fotoğrafları). Yalnızca yeni tablo; mevcut veri değişmez.

-- CreateTable
CREATE TABLE "VehicleDocument" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleDocument_path_key" ON "VehicleDocument"("path");

-- CreateIndex
CREATE INDEX "VehicleDocument_vehicleId_idx" ON "VehicleDocument"("vehicleId");

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

