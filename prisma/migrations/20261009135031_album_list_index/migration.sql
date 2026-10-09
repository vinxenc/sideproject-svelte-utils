-- DropIndex
DROP INDEX "album_userId_idx";

-- CreateIndex
CREATE INDEX "album_userId_updatedAt_id_idx" ON "album"("userId", "updatedAt" DESC, "id" DESC);
