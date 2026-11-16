-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "stockCode" TEXT,
ADD COLUMN     "warrantyKm" INTEGER,
ADD COLUMN     "warrantyStatus" TEXT,
ADD COLUMN     "warrantyUntil" TEXT;

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT,
    "authorizationNo" TEXT,
    "mersis" TEXT,
    "address" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

