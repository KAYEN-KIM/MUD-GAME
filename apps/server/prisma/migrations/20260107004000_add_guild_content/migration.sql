-- Guild content expansion: Vault, Buff, War, Quest

-- Add vaultGold to Guild
ALTER TABLE "Guild" ADD COLUMN "vaultGold" INTEGER NOT NULL DEFAULT 0;

-- Guild Vault Items
CREATE TABLE "GuildVaultItem" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "depositedBy" TEXT NOT NULL,
  "depositedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuildVaultItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildVaultItem_guildId_itemId_key" ON "GuildVaultItem"("guildId", "itemId");
CREATE INDEX "GuildVaultItem_guildId_idx" ON "GuildVaultItem"("guildId");
CREATE INDEX "GuildVaultItem_depositedBy_idx" ON "GuildVaultItem"("depositedBy");

ALTER TABLE "GuildVaultItem"
ADD CONSTRAINT "GuildVaultItem_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuildVaultItem"
ADD CONSTRAINT "GuildVaultItem_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guild Buffs
CREATE TABLE "GuildBuff" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "expBonus" INTEGER NOT NULL DEFAULT 0,
  "goldBonus" INTEGER NOT NULL DEFAULT 0,
  "atkBonus" INTEGER NOT NULL DEFAULT 0,
  "defBonus" INTEGER NOT NULL DEFAULT 0,
  "hpBonus" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuildBuff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildBuff_guildId_key" ON "GuildBuff"("guildId");

ALTER TABLE "GuildBuff"
ADD CONSTRAINT "GuildBuff_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guild War
CREATE TYPE "GuildWarStatus" AS ENUM ('PENDING', 'ACTIVE', 'FINISHED', 'CANCELLED');

CREATE TABLE "GuildWar" (
  "id" TEXT NOT NULL,
  "challengerGuildId" TEXT NOT NULL,
  "defenderGuildId" TEXT NOT NULL,
  "status" "GuildWarStatus" NOT NULL DEFAULT 'PENDING',
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "winnerGuildId" TEXT,
  "challengerScore" INTEGER NOT NULL DEFAULT 0,
  "defenderScore" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuildWar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuildWar_challengerGuildId_idx" ON "GuildWar"("challengerGuildId");
CREATE INDEX "GuildWar_defenderGuildId_idx" ON "GuildWar"("defenderGuildId");
CREATE INDEX "GuildWar_status_createdAt_idx" ON "GuildWar"("status", "createdAt");

ALTER TABLE "GuildWar"
ADD CONSTRAINT "GuildWar_challengerGuildId_fkey"
FOREIGN KEY ("challengerGuildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuildWar"
ADD CONSTRAINT "GuildWar_defenderGuildId_fkey"
FOREIGN KEY ("defenderGuildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuildWarMatch" (
  "id" TEXT NOT NULL,
  "warId" TEXT NOT NULL,
  "challengerCharacterId" TEXT NOT NULL,
  "defenderCharacterId" TEXT NOT NULL,
  "winnerId" TEXT,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuildWarMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuildWarMatch_warId_idx" ON "GuildWarMatch"("warId");
CREATE INDEX "GuildWarMatch_challengerCharacterId_idx" ON "GuildWarMatch"("challengerCharacterId");
CREATE INDEX "GuildWarMatch_defenderCharacterId_idx" ON "GuildWarMatch"("defenderCharacterId");

ALTER TABLE "GuildWarMatch"
ADD CONSTRAINT "GuildWarMatch_warId_fkey"
FOREIGN KEY ("warId") REFERENCES "GuildWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guild Quest
CREATE TABLE "GuildQuest" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "questId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "target" INTEGER NOT NULL DEFAULT 1,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "GuildQuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildQuest_guildId_questId_key" ON "GuildQuest"("guildId", "questId");
CREATE INDEX "GuildQuest_guildId_idx" ON "GuildQuest"("guildId");
CREATE INDEX "GuildQuest_status_idx" ON "GuildQuest"("status");

ALTER TABLE "GuildQuest"
ADD CONSTRAINT "GuildQuest_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

