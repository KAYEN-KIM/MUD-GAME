-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "lastRestAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "dangerLevel" INTEGER,
ADD COLUMN     "depth" INTEGER,
ADD COLUMN     "recommendedLevel" INTEGER,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "zoneId" TEXT;

-- AlterTable
ALTER TABLE "RoomExit" ADD COLUMN     "minLevel" INTEGER;
