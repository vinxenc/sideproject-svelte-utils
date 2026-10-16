-- DropIndex
DROP INDEX "album_userId_updatedAt_id_idx";

-- CreateIndex
CREATE INDEX "album_userId_createdAt_id_idx" ON "album"("userId", "createdAt" DESC, "id" DESC);
