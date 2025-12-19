#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const startTown = await prisma.room.findUnique({
    where: { id: 'START_TOWN' },
  });

  if (!startTown) {
    console.log('❌ START_TOWN을 찾을 수 없습니다!');
    return;
  }

  console.log(`✓ START_TOWN 존재: ${startTown.name}`);

  const exits = await prisma.roomExit.findMany({
    where: { fromRoomId: 'START_TOWN' },
  });

  console.log(`\nSTART_TOWN에서 나가는 출구: ${exits.length}개`);
  exits.forEach((exit) => {
    console.log(`  - ${exit.label || '(라벨 없음)'} → ${exit.toRoomId}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);

