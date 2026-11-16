-- Takasa uygunluk (araç başına). Yalnızca boş sütun eklenir; mevcut kayıtlar "belirtilmedi" (NULL) kalır, veri uydurulmaz.
ALTER TABLE "Vehicle" ADD COLUMN "tradeIn" BOOLEAN;
