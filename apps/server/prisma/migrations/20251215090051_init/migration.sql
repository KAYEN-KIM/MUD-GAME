-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('GLOBAL', 'LOCAL', 'PARTY', 'WHISPER');

-- CreateEnum
CREATE TYPE "LogScope" AS ENUM ('SYSTEM', 'WORLD', 'COMBAT', 'CHAT');

-- CreateEnum
CREATE TYPE "AutoPreset" AS ENUM ('AGGRO', 'GUARD', 'SAVER', 'SUSTAIN', 'SUPPORT', 'RETREAT');

-- CreateEnum
CREATE TYPE "PartySpeedMode" AS ENUM ('FAST', 'TACTICAL');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "PunishmentType" AS ENUM ('MUTE', 'BAN');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('ACTIVE', 'DONE');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL DEFAULT 100,
    "hpMax" INTEGER NOT NULL DEFAULT 100,
    "stamina" INTEGER NOT NULL DEFAULT 100,
    "staminaMax" INTEGER NOT NULL DEFAULT 100,
    "str" INTEGER NOT NULL DEFAULT 10,
    "dex" INTEGER NOT NULL DEFAULT 10,
    "intStat" INTEGER NOT NULL DEFAULT 10,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomExit" (
    "id" TEXT NOT NULL,
    "fromRoomId" TEXT NOT NULL,
    "toRoomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "condJson" JSONB,

    CONSTRAINT "RoomExit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "atk" INTEGER NOT NULL,
    "def" INTEGER NOT NULL,
    "aiJson" JSONB,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomSpawn" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "RoomSpawn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "stackMax" INTEGER NOT NULL DEFAULT 1,
    "effectJson" JSONB,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonsterDrop" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "maxQty" INTEGER NOT NULL DEFAULT 1,
    "chanceBp" INTEGER NOT NULL DEFAULT 10000,

    CONSTRAINT "MonsterDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardJson" JSONB,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'ACTIVE',
    "progressJson" JSONB,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "leaderCharacterId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "speedMode" "PartySpeedMode" NOT NULL DEFAULT 'TACTICAL',
    "defaultPreset" "AutoPreset" NOT NULL DEFAULT 'AGGRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMember" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL DEFAULT 'MEMBER',
    "follow" BOOLEAN NOT NULL DEFAULT true,
    "autoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPreset" "AutoPreset" NOT NULL DEFAULT 'AGGRO',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyInvite" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "fromCharacterId" TEXT NOT NULL,
    "toCharacterName" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "partyId" TEXT,
    "roomId" TEXT NOT NULL,
    "isBoss" BOOLEAN NOT NULL DEFAULT false,
    "turnNo" INTEGER NOT NULL DEFAULT 0,
    "turnDeadlineAt" TIMESTAMP(3) NOT NULL,
    "timeBankRemaining" INTEGER NOT NULL DEFAULT 1,
    "stateJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "roomId" TEXT,
    "partyId" TEXT,
    "fromCharacterId" TEXT NOT NULL,
    "toName" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterCharacterId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Punishment" (
    "id" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "type" "PunishmentType" NOT NULL,
    "untilAt" TIMESTAMP(3),
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Punishment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Character_roomId_idx" ON "Character"("roomId");

-- CreateIndex
CREATE INDEX "Character_name_idx" ON "Character"("name");

-- CreateIndex
CREATE INDEX "RoomExit_fromRoomId_idx" ON "RoomExit"("fromRoomId");

-- CreateIndex
CREATE INDEX "RoomExit_toRoomId_idx" ON "RoomExit"("toRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomExit_fromRoomId_label_key" ON "RoomExit"("fromRoomId", "label");

-- CreateIndex
CREATE INDEX "RoomSpawn_roomId_idx" ON "RoomSpawn"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomSpawn_roomId_monsterId_key" ON "RoomSpawn"("roomId", "monsterId");

-- CreateIndex
CREATE INDEX "Inventory_characterId_idx" ON "Inventory"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_characterId_itemId_key" ON "Inventory"("characterId", "itemId");

-- CreateIndex
CREATE INDEX "Equipment_characterId_idx" ON "Equipment"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_characterId_slot_key" ON "Equipment"("characterId", "slot");

-- CreateIndex
CREATE INDEX "MonsterDrop_monsterId_idx" ON "MonsterDrop"("monsterId");

-- CreateIndex
CREATE UNIQUE INDEX "MonsterDrop_monsterId_itemId_key" ON "MonsterDrop"("monsterId", "itemId");

-- CreateIndex
CREATE INDEX "QuestProgress_characterId_idx" ON "QuestProgress"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_characterId_questId_key" ON "QuestProgress"("characterId", "questId");

-- CreateIndex
CREATE INDEX "Party_leaderCharacterId_idx" ON "Party"("leaderCharacterId");

-- CreateIndex
CREATE INDEX "Party_roomId_idx" ON "Party"("roomId");

-- CreateIndex
CREATE INDEX "PartyMember_partyId_idx" ON "PartyMember"("partyId");

-- CreateIndex
CREATE INDEX "PartyMember_characterId_idx" ON "PartyMember"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMember_partyId_characterId_key" ON "PartyMember"("partyId", "characterId");

-- CreateIndex
CREATE INDEX "PartyInvite_partyId_idx" ON "PartyInvite"("partyId");

-- CreateIndex
CREATE INDEX "PartyInvite_toCharacterName_idx" ON "PartyInvite"("toCharacterName");

-- CreateIndex
CREATE INDEX "Encounter_partyId_idx" ON "Encounter"("partyId");

-- CreateIndex
CREATE INDEX "Encounter_roomId_idx" ON "Encounter"("roomId");

-- CreateIndex
CREATE INDEX "ChatMessage_fromCharacterId_idx" ON "ChatMessage"("fromCharacterId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_idx" ON "ChatMessage"("roomId");

-- CreateIndex
CREATE INDEX "ChatMessage_partyId_idx" ON "ChatMessage"("partyId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterCharacterId_idx" ON "Report"("reporterCharacterId");

-- CreateIndex
CREATE INDEX "Report_targetName_idx" ON "Report"("targetName");

-- CreateIndex
CREATE INDEX "Punishment_targetName_idx" ON "Punishment"("targetName");

-- CreateIndex
CREATE INDEX "Punishment_type_idx" ON "Punishment"("type");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomExit" ADD CONSTRAINT "RoomExit_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomExit" ADD CONSTRAINT "RoomExit_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomSpawn" ADD CONSTRAINT "RoomSpawn_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomSpawn" ADD CONSTRAINT "RoomSpawn_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterDrop" ADD CONSTRAINT "MonsterDrop_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterDrop" ADD CONSTRAINT "MonsterDrop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInvite" ADD CONSTRAINT "PartyInvite_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyInvite" ADD CONSTRAINT "PartyInvite_fromCharacterId_fkey" FOREIGN KEY ("fromCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_fromCharacterId_fkey" FOREIGN KEY ("fromCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterCharacterId_fkey" FOREIGN KEY ("reporterCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
