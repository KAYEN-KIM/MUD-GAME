#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ledgerOffice = await prisma.room.findUnique({
    where: { id: 'GH_LEDGER_OFFICE' },
  });

  if (!ledgerOffice) {
    console.log('❌ GH_LEDGER_OFFICE를 찾을 수 없습니다!');
  } else {
    console.log(`✓ GH_LEDGER_OFFICE 존재: ${ledgerOffice.name}`);
  }

  const exitsTo = await prisma.roomExit.findMany({
    where: { toRoomId: 'GH_LEDGER_OFFICE' },
  });

  console.log(`\nGH_LEDGER_OFFICE로 가는 출구: ${exitsTo.length}개`);
  for (const exit of exitsTo) {
    const fromRoom = await prisma.room.findUnique({ where: { id: exit.fromRoomId } });
    console.log(`  - ${fromRoom?.name || exit.fromRoomId} → GH_LEDGER_OFFICE`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

