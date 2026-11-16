-- Faz 2–5 (yalnızca yerel): ruhsat ticari adı (D.3), muayene tarihi, arşiv bilgileri ve bildirim abonelikleri.
-- Yalnızca boş sütun / yeni tablo eklenir; mevcut kayıtlar değişmez.
ALTER TABLE "Vehicle" ADD COLUMN "tradeName" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "inspectionUntil" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "archivedFromStatus" TEXT;

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
