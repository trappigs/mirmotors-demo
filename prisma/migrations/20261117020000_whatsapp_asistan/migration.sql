-- WhatsApp asistanı: personel telefon numarası ve mesaj yönü. Yalnızca boş sütun eklenir; mevcut kayıtlar değişmez.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
ALTER TABLE "WhatsAppMessage" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'IN';
