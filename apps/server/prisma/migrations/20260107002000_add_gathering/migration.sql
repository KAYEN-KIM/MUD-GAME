-- Gathering system: ResourceNode and NodeSpawn

CREATE TABLE "ResourceNode" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "maxHp" INTEGER NOT NULL DEFAULT 100,
  "currentHp" INTEGER NOT NULL DEFAULT 100,
  "respawnAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResourceNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResourceNode_roomId_nodeType_key" ON "ResourceNode"("roomId", "nodeType");
CREATE INDEX "ResourceNode_roomId_idx" ON "ResourceNode"("roomId");
CREATE INDEX "ResourceNode_respawnAt_idx" ON "ResourceNode"("respawnAt");

ALTER TABLE "ResourceNode"
ADD CONSTRAINT "ResourceNode_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NodeSpawn" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "spawnChance" INTEGER NOT NULL DEFAULT 10000,
  "minHp" INTEGER NOT NULL DEFAULT 100,
  "maxHp" INTEGER NOT NULL DEFAULT 100,
  "respawnMinutes" INTEGER NOT NULL DEFAULT 60,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NodeSpawn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NodeSpawn_roomId_nodeType_key" ON "NodeSpawn"("roomId", "nodeType");
CREATE INDEX "NodeSpawn_roomId_idx" ON "NodeSpawn"("roomId");

ALTER TABLE "NodeSpawn"
ADD CONSTRAINT "NodeSpawn_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

