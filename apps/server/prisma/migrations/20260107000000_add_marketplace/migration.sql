-- Marketplace system: Listing and Bidding

-- ===== Marketplace =====
CREATE TYPE "MarketplaceListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

CREATE TABLE "MarketplaceListing" (
  "id" TEXT NOT NULL,
  "sellerCharacterId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "startingPrice" INTEGER NOT NULL,
  "buyNowPrice" INTEGER,
  "currentBid" INTEGER,
  "currentBidderId" TEXT,
  "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceListing_sellerCharacterId_idx" ON "MarketplaceListing"("sellerCharacterId");
CREATE INDEX "MarketplaceListing_itemId_idx" ON "MarketplaceListing"("itemId");
CREATE INDEX "MarketplaceListing_status_expiresAt_idx" ON "MarketplaceListing"("status", "expiresAt");
CREATE INDEX "MarketplaceListing_status_createdAt_idx" ON "MarketplaceListing"("status", "createdAt");

ALTER TABLE "MarketplaceListing"
ADD CONSTRAINT "MarketplaceListing_sellerCharacterId_fkey"
FOREIGN KEY ("sellerCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceListing"
ADD CONSTRAINT "MarketplaceListing_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketplaceBid" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "bidderCharacterId" TEXT NOT NULL,
  "bidAmount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketplaceBid_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceBid_listingId_createdAt_idx" ON "MarketplaceBid"("listingId", "createdAt");
CREATE INDEX "MarketplaceBid_bidderCharacterId_idx" ON "MarketplaceBid"("bidderCharacterId");

ALTER TABLE "MarketplaceBid"
ADD CONSTRAINT "MarketplaceBid_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceBid"
ADD CONSTRAINT "MarketplaceBid_bidderCharacterId_fkey"
FOREIGN KEY ("bidderCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

