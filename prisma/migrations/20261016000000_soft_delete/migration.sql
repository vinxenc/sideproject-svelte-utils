-- AlterTable
ALTER TABLE "media" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "album" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "password" ADD COLUMN "deletedAt" TIMESTAMP(3);
