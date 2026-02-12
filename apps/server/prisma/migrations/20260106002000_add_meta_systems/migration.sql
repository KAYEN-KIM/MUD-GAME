-- Meta systems: Guild / Achievements / Exploration visits / Trade

-- ===== Guild =====
CREATE TABLE "Guild" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "level" INTEGER NOT NULL DEFAULT 1,
  "exp" INTEGER NOT NULL DEFAULT 0,
  "maxMembers" INTEGER NOT NULL DEFAULT 30,
  "leaderCharacterId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");
CREATE INDEX "Guild_leaderCharacterId_idx" ON "Guild"("leaderCharacterId");
CREATE INDEX "Guild_level_idx" ON "Guild"("level");

CREATE TABLE "GuildMember" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildMember_guildId_characterId_key" ON "GuildMember"("guildId", "characterId");
CREATE UNIQUE INDEX "GuildMember_characterId_key" ON "GuildMember"("characterId");
CREATE INDEX "GuildMember_guildId_idx" ON "GuildMember"("guildId");

ALTER TABLE "GuildMember"
ADD CONSTRAINT "GuildMember_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuildMember"
ADD CONSTRAINT "GuildMember_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Achievements =====
CREATE TABLE "CharacterAchievement" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "target" INTEGER NOT NULL DEFAULT 1,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CharacterAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterAchievement_characterId_achievementId_key"
ON "CharacterAchievement"("characterId", "achievementId");
CREATE INDEX "CharacterAchievement_characterId_idx" ON "CharacterAchievement"("characterId");

ALTER TABLE "CharacterAchievement"
ADD CONSTRAINT "CharacterAchievement_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Exploration (room visits) =====
CREATE TABLE "CharacterRoomVisit" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CharacterRoomVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterRoomVisit_characterId_roomId_key" ON "CharacterRoomVisit"("characterId", "roomId");
CREATE INDEX "CharacterRoomVisit_characterId_idx" ON "CharacterRoomVisit"("characterId");
CREATE INDEX "CharacterRoomVisit_roomId_idx" ON "CharacterRoomVisit"("roomId");

ALTER TABLE "CharacterRoomVisit"
ADD CONSTRAINT "CharacterRoomVisit_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterRoomVisit"
ADD CONSTRAINT "CharacterRoomVisit_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Trade =====
DO $$ BEGIN
  CREATE TYPE "TradeOfferStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED','CANCELLED','EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "TradeOffer" (
  "id" TEXT NOT NULL,
  "fromCharacterId" TEXT NOT NULL,
  "toCharacterId" TEXT NOT NULL,
  "offeredGold" INTEGER NOT NULL DEFAULT 0,
  "status" "TradeOfferStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradeOffer_fromCharacterId_idx" ON "TradeOffer"("fromCharacterId");
CREATE INDEX "TradeOffer_toCharacterId_idx" ON "TradeOffer"("toCharacterId");
CREATE INDEX "TradeOffer_status_createdAt_idx" ON "TradeOffer"("status", "createdAt");

ALTER TABLE "TradeOffer"
ADD CONSTRAINT "TradeOffer_fromCharacterId_fkey"
FOREIGN KEY ("fromCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeOffer"
ADD CONSTRAINT "TradeOffer_toCharacterId_fkey"
FOREIGN KEY ("toCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TradeOfferItem" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "TradeOfferItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradeOfferItem_offerId_idx" ON "TradeOfferItem"("offerId");
CREATE INDEX "TradeOfferItem_itemId_idx" ON "TradeOfferItem"("itemId");

ALTER TABLE "TradeOfferItem"
ADD CONSTRAINT "TradeOfferItem_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeOfferItem"
ADD CONSTRAINT "TradeOfferItem_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;


