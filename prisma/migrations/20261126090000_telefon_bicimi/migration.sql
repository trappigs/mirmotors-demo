-- Personel telefonu Burak'ın personel ekranıyla aynı biçime çevrilir: 905XXXXXXXXX → +905XXXXXXXXX (WhatsApp asistanı + işaretini kaldırarak eşleştirir)
UPDATE "User" SET "phone" = '+' || "phone" WHERE "phone" ~ '^90[0-9]{10}$';
