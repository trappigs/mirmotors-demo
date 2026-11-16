-- Otomatik taslak: aynı giriş tekrar gönderildiğinde ikinci araç oluşmasın diye tek kullanımlık anahtar.
-- Yalnızca boş sütun eklenir; mevcut kayıtlar NULL kalır (PostgreSQL'de birden fazla NULL benzersizliği bozmaz).
ALTER TABLE "Vehicle" ADD COLUMN "createKey" TEXT;
CREATE UNIQUE INDEX "Vehicle_createKey_key" ON "Vehicle"("createKey");
