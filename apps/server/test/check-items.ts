#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.item.findMany({
    where: {
      OR: [
        { id: { contains: 'LEDGER' } },
        { id: { contains: 'ICON' } },
        { id: { contains: 'TITLE' } },
      ],
    },
  });

  console.log('Found items:');
  items.forEach((item) => {
    console.log(`  - ${item.id}: ${item.name}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);

