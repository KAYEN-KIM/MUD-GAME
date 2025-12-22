-- AlterTable
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Character' AND column_name = 'cosmeticIconItemId') THEN
        ALTER TABLE "Character" ADD COLUMN "cosmeticIconItemId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Character' AND column_name = 'cosmeticTitleItemId') THEN
        ALTER TABLE "Character" ADD COLUMN "cosmeticTitleItemId" TEXT;
    END IF;
END $$;
