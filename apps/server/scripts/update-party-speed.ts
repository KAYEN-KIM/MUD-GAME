import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('기존 파티의 speedMode를 FAST로 업데이트 중...');
  
  const result = await prisma.party.updateMany({
    where: {
      speedMode: 'TACTICAL',
    },
    data: {
      speedMode: 'FAST',
    },
  });

  console.log(`${result.count}개의 파티가 FAST 모드로 업데이트되었습니다.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

