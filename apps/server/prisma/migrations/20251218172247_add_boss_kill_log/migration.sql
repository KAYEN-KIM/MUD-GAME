-- CreateTable
CREATE TABLE "BossKillLog" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "killedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BossKillLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BossKillLog_roomId_bossId_key" ON "BossKillLog"("roomId", "bossId");

-- CreateIndex
CREATE INDEX "BossKillLog_roomId_idx" ON "BossKillLog"("roomId");

