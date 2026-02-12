-- Pet/Companion, Housing/Farm, Event, Ranking Expansion Systems

CREATE TYPE "PetType" AS ENUM ('COMBAT', 'GATHERING', 'TRADING', 'EXPLORATION');
CREATE TYPE "PetRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
CREATE TYPE "EventType" AS ENUM ('DAILY', 'WEEKLY', 'SEASONAL', 'LIMITED');
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'ENDED');

-- Pet System
CREATE TABLE "Pet" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PetType" NOT NULL,
  "rarity" "PetRarity" NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "exp" INTEGER NOT NULL DEFAULT 0,
  "hp" INTEGER NOT NULL DEFAULT 100,
  "hpMax" INTEGER NOT NULL DEFAULT 100,
  "atk" INTEGER NOT NULL DEFAULT 10,
  "def" INTEGER NOT NULL DEFAULT 5,
  "skills" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Pet_characterId_idx" ON "Pet"("characterId");
CREATE INDEX "Pet_type_rarity_idx" ON "Pet"("type", "rarity");

ALTER TABLE "Pet"
ADD CONSTRAINT "Pet_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Housing System
CREATE TABLE "House" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "capacity" INTEGER NOT NULL DEFAULT 10,
  "location" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "House_characterId_key" ON "House"("characterId");
CREATE INDEX "House_characterId_idx" ON "House"("characterId");

ALTER TABLE "House"
ADD CONSTRAINT "House_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FarmPlot" (
  "id" TEXT NOT NULL,
  "houseId" TEXT NOT NULL,
  "plotIndex" INTEGER NOT NULL,
  "cropId" TEXT,
  "plantedAt" TIMESTAMP(3),
  "harvestAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'EMPTY',

  CONSTRAINT "FarmPlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmPlot_houseId_plotIndex_key" ON "FarmPlot"("houseId", "plotIndex");
CREATE INDEX "FarmPlot_houseId_idx" ON "FarmPlot"("houseId");

ALTER TABLE "FarmPlot"
ADD CONSTRAINT "FarmPlot_houseId_fkey"
FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HouseStorage" (
  "id" TEXT NOT NULL,
  "houseId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "HouseStorage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HouseStorage_houseId_itemId_key" ON "HouseStorage"("houseId", "itemId");
CREATE INDEX "HouseStorage_houseId_idx" ON "HouseStorage"("houseId");

ALTER TABLE "HouseStorage"
ADD CONSTRAINT "HouseStorage_houseId_fkey"
FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseStorage"
ADD CONSTRAINT "HouseStorage_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Event System
CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "EventType" NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "rewardsJson" JSONB,
  "configJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_status_startAt_endAt_idx" ON "Event"("status", "startAt", "endAt");
CREATE INDEX "Event_type_idx" ON "Event"("type");

CREATE TABLE "EventParticipation" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "progress" JSONB NOT NULL,
  "claimedRewards" JSONB,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventParticipation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventParticipation_eventId_characterId_key" ON "EventParticipation"("eventId", "characterId");
CREATE INDEX "EventParticipation_eventId_idx" ON "EventParticipation"("eventId");
CREATE INDEX "EventParticipation_characterId_idx" ON "EventParticipation"("characterId");

ALTER TABLE "EventParticipation"
ADD CONSTRAINT "EventParticipation_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventParticipation"
ADD CONSTRAINT "EventParticipation_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ranking Expansion
CREATE TABLE "DungeonRanking" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "dungeonId" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "bestTime" INTEGER,
  "clearCount" INTEGER NOT NULL DEFAULT 0,
  "totalExp" INTEGER NOT NULL DEFAULT 0,
  "totalGold" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DungeonRanking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DungeonRanking_characterId_key" ON "DungeonRanking"("characterId");
CREATE INDEX "DungeonRanking_dungeonId_difficulty_bestTime_idx" ON "DungeonRanking"("dungeonId", "difficulty", "bestTime");
CREATE INDEX "DungeonRanking_characterId_idx" ON "DungeonRanking"("characterId");

ALTER TABLE "DungeonRanking"
ADD CONSTRAINT "DungeonRanking_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RaidRanking" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "raidId" TEXT NOT NULL,
  "clearCount" INTEGER NOT NULL DEFAULT 0,
  "bestTime" INTEGER,
  "totalExp" INTEGER NOT NULL DEFAULT 0,
  "totalGold" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RaidRanking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaidRanking_characterId_raidId_key" ON "RaidRanking"("characterId", "raidId");
CREATE INDEX "RaidRanking_raidId_clearCount_idx" ON "RaidRanking"("raidId", "clearCount");
CREATE INDEX "RaidRanking_characterId_idx" ON "RaidRanking"("characterId");

ALTER TABLE "RaidRanking"
ADD CONSTRAINT "RaidRanking_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

