-- WhatsApp asistanı (2. aşama): personel onayı bekleyen işlemler. Yalnız yeni tablo; mevcut kayıtlar değişmez.
CREATE TABLE "AssistantAction" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "price" INTEGER,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "AssistantAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantAction_waId_status_idx" ON "AssistantAction"("waId", "status");
