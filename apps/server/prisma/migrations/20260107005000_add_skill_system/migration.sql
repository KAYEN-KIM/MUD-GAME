-- Skill System: CharacterSkill table

CREATE TABLE "CharacterSkill" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "learnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),

  CONSTRAINT "CharacterSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterSkill_characterId_skillId_key" ON "CharacterSkill"("characterId", "skillId");
CREATE INDEX "CharacterSkill_characterId_idx" ON "CharacterSkill"("characterId");
CREATE INDEX "CharacterSkill_skillId_idx" ON "CharacterSkill"("skillId");

ALTER TABLE "CharacterSkill"
ADD CONSTRAINT "CharacterSkill_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

