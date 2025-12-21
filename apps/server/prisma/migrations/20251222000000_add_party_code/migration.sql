-- AlterTable
ALTER TABLE "Party" ADD COLUMN "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Party_code_key" ON "Party"("code");

-- CreateIndex
CREATE INDEX "Party_code_idx" ON "Party"("code");

