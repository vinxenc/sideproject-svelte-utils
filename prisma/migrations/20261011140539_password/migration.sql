-- CreateEnum
CREATE TYPE "password_type" AS ENUM ('APP', 'CREDIT_CARD', 'API_KEY', 'PIN_PLATFORM');

-- CreateTable
CREATE TABLE "password" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "type" "password_type" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_userId_createdAt_id_idx" ON "password"("userId", "createdAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "password" ADD CONSTRAINT "password_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
