-- CreateTable
CREATE TABLE IF NOT EXISTS "CharacterStoryChapter" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "choice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterStoryChapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterStoryChapter_characterId_chapterId_key" ON "CharacterStoryChapter"("characterId", "chapterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CharacterStoryChapter_characterId_idx" ON "CharacterStoryChapter"("characterId");

-- AddForeignKey
ALTER TABLE "CharacterStoryChapter" ADD CONSTRAINT "CharacterStoryChapter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;


