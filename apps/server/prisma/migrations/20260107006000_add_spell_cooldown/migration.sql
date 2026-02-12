-- Spell Cooldown System: CharacterSpellCooldown table

CREATE TABLE "CharacterSpellCooldown" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "spellId" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CharacterSpellCooldown_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterSpellCooldown_characterId_spellId_key" ON "CharacterSpellCooldown"("characterId", "spellId");
CREATE INDEX "CharacterSpellCooldown_characterId_idx" ON "CharacterSpellCooldown"("characterId");
CREATE INDEX "CharacterSpellCooldown_spellId_idx" ON "CharacterSpellCooldown"("spellId");

ALTER TABLE "CharacterSpellCooldown"
ADD CONSTRAINT "CharacterSpellCooldown_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

