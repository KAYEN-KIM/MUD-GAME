-- AlterTable QuestProgress (add new columns first)
ALTER TABLE "QuestProgress" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "QuestProgress" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "QuestProgress" ADD COLUMN IF NOT EXISTS "turnedInAt" TIMESTAMP(3);

-- Change status column to text temporarily
ALTER TABLE "QuestProgress" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

-- Drop old enum if exists
DROP TYPE IF EXISTS "QuestStatus" CASCADE;

-- Create new enum
CREATE TYPE "QuestProgressStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TURNED_IN');

-- Update existing status values
UPDATE "QuestProgress" SET "status" = 'COMPLETED' WHERE "status" = 'DONE';

-- Change status column to new enum
ALTER TABLE "QuestProgress" ALTER COLUMN "status" TYPE "QuestProgressStatus" USING "status"::"QuestProgressStatus";
ALTER TABLE "QuestProgress" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"QuestProgressStatus";

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuestTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "giverRoomId" TEXT NOT NULL,
    "turninRoomId" TEXT NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "objectivesJson" JSONB NOT NULL,
    "rewardsJson" JSONB NOT NULL,
    CONSTRAINT "QuestTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuestProgress_questId_idx" ON "QuestProgress"("questId");
CREATE INDEX IF NOT EXISTS "QuestProgress_status_idx" ON "QuestProgress"("status");

-- AddForeignKey
ALTER TABLE "QuestProgress" DROP CONSTRAINT IF EXISTS "QuestProgress_questId_fkey";
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" 
  FOREIGN KEY ("questId") REFERENCES "QuestTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
