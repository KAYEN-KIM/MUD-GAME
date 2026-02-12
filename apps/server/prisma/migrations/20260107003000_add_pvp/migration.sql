-- PVP system: PvpMatch and PvpRanking

CREATE TYPE "PvpMatchStatus" AS ENUM ('PENDING', 'ACTIVE', 'FINISHED', 'CANCELLED');

CREATE TABLE "PvpMatch" (
  "id" TEXT NOT NULL,
  "challengerId" TEXT NOT NULL,
  "defenderId" TEXT NOT NULL,
  "betGold" INTEGER NOT NULL DEFAULT 0,
  "status" "PvpMatchStatus" NOT NULL DEFAULT 'PENDING',
  "winnerId" TEXT,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PvpMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PvpMatch_challengerId_idx" ON "PvpMatch"("challengerId");
CREATE INDEX "PvpMatch_defenderId_idx" ON "PvpMatch"("defenderId");
CREATE INDEX "PvpMatch_status_createdAt_idx" ON "PvpMatch"("status", "createdAt");

ALTER TABLE "PvpMatch"
ADD CONSTRAINT "PvpMatch_challengerId_fkey"
FOREIGN KEY ("challengerId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PvpMatch"
ADD CONSTRAINT "PvpMatch_defenderId_fkey"
FOREIGN KEY ("defenderId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PvpRanking" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL DEFAULT 1000,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PvpRanking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PvpRanking_characterId_key" ON "PvpRanking"("characterId");
CREATE INDEX "PvpRanking_rating_idx" ON "PvpRanking"("rating");

ALTER TABLE "PvpRanking"
ADD CONSTRAINT "PvpRanking_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

