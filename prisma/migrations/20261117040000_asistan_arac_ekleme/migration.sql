-- WhatsApp asistanı (3. aşama): araç ekleme önerisi. Araç onayda oluşur; öneri anında araç kimliği yoktur.
ALTER TABLE "AssistantAction" ALTER COLUMN "vehicleId" DROP NOT NULL;
ALTER TABLE "AssistantAction" ADD COLUMN "payload" TEXT;
