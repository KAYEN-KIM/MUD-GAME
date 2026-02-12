-- Dungeon & Raid System

CREATE TYPE "DungeonDifficulty" AS ENUM ('EASY', 'NORMAL', 'HARD', 'NIGHTMARE');

CREATE TABLE "Dungeon" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "entryRoomId" TEXT NOT NULL,
  "minLevel" INTEGER NOT NULL DEFAULT 1,
  "maxLevel" INTEGER NOT NULL DEFAULT 100,
  "requiredPartySize" INTEGER NOT NULL DEFAULT 1,
  "maxPartySize" INTEGER NOT NULL DEFAULT 6,
  "roomCount" INTEGER NOT NULL DEFAULT 5,
  "expMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "goldMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "itemDropMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Dungeon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dungeon_entryRoomId_idx" ON "Dungeon"("entryRoomId");
CREATE INDEX "Dungeon_minLevel_maxLevel_idx" ON "Dungeon"("minLevel", "maxLevel");

ALTER TABLE "Dungeon"
ADD CONSTRAINT "Dungeon_entryRoomId_fkey"
FOREIGN KEY ("entryRoomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DungeonInstance" (
  "id" TEXT NOT NULL,
  "dungeonId" TEXT NOT NULL,
  "difficulty" "DungeonDifficulty" NOT NULL DEFAULT 'NORMAL',
  "partyId" TEXT NOT NULL,
  "currentRoomId" TEXT NOT NULL,
  "clearedRooms" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "DungeonInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DungeonInstance_dungeonId_idx" ON "DungeonInstance"("dungeonId");
CREATE INDEX "DungeonInstance_partyId_idx" ON "DungeonInstance"("partyId");
CREATE INDEX "DungeonInstance_status_idx" ON "DungeonInstance"("status");

ALTER TABLE "DungeonInstance"
ADD CONSTRAINT "DungeonInstance_dungeonId_fkey"
FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DungeonInstance"
ADD CONSTRAINT "DungeonInstance_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Raid" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "entryRoomId" TEXT NOT NULL,
  "minLevel" INTEGER NOT NULL DEFAULT 1,
  "maxLevel" INTEGER NOT NULL DEFAULT 100,
  "requiredPartySize" INTEGER NOT NULL DEFAULT 10,
  "maxPartySize" INTEGER NOT NULL DEFAULT 20,
  "roomCount" INTEGER NOT NULL DEFAULT 10,
  "bossCount" INTEGER NOT NULL DEFAULT 3,
  "expMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  "goldMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  "itemDropMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Raid_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Raid_entryRoomId_idx" ON "Raid"("entryRoomId");

ALTER TABLE "Raid"
ADD CONSTRAINT "Raid_entryRoomId_fkey"
FOREIGN KEY ("entryRoomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RaidInstance" (
  "id" TEXT NOT NULL,
  "raidId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "currentRoomId" TEXT NOT NULL,
  "clearedRooms" JSONB NOT NULL,
  "defeatedBosses" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "RaidInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RaidInstance_raidId_idx" ON "RaidInstance"("raidId");
CREATE INDEX "RaidInstance_partyId_idx" ON "RaidInstance"("partyId");
CREATE INDEX "RaidInstance_status_idx" ON "RaidInstance"("status");

ALTER TABLE "RaidInstance"
ADD CONSTRAINT "RaidInstance_raidId_fkey"
FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RaidInstance"
ADD CONSTRAINT "RaidInstance_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

