-- AlterTable
ALTER TABLE "media" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "album" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows with when they were created
UPDATE "media" SET "updatedAt" = "createdAt";
UPDATE "album" SET "updatedAt" = "createdAt";
