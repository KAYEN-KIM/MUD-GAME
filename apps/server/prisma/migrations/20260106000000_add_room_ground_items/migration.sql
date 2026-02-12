-- Add RoomGroundItem table (persistent room-floor items)
CREATE TABLE "RoomGroundItem" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RoomGroundItem_pkey" PRIMARY KEY ("id")
);

-- Unique per room/item
CREATE UNIQUE INDEX "RoomGroundItem_roomId_itemId_key" ON "RoomGroundItem"("roomId", "itemId");
CREATE INDEX "RoomGroundItem_roomId_idx" ON "RoomGroundItem"("roomId");
CREATE INDEX "RoomGroundItem_itemId_idx" ON "RoomGroundItem"("itemId");

-- Foreign keys
ALTER TABLE "RoomGroundItem"
ADD CONSTRAINT "RoomGroundItem_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomGroundItem"
ADD CONSTRAINT "RoomGroundItem_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;


