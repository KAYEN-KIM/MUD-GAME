-- Enhancement system: Add enhanceLevel to Equipment

ALTER TABLE "Equipment" ADD COLUMN "enhanceLevel" INTEGER NOT NULL DEFAULT 0;

