-- Araç tipi (ruhsat D.2) ayrı alan: Yönetmelik m.20/2-a "markası, ticari adı, cinsi, tipi".
-- Yalnızca boş sütun eklenir; mevcut kayıtlar "bilgi girilmedi" (NULL) olarak kalır, veri uydurulmaz.
-- Hasar kaydı (NOT_QUERIED, UNVERIFIED), rehin/haciz (UNVERIFIED) ve garanti (UNKNOWN) için yeni değerler metin sütunlarında tutulur; şema değişikliği gerektirmez.
ALTER TABLE "Vehicle" ADD COLUMN "vehicleType" TEXT;
