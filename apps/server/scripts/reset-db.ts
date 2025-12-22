import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  데이터베이스 초기화 시작...');
  
  // 순서 중요: 외래 키 제약 조건 때문에 역순으로 삭제
  console.log('  - 퀘스트 진행도 삭제 중...');
  await prisma.questProgress.deleteMany({});
  
  console.log('  - 인벤토리 삭제 중...');
  await prisma.inventory.deleteMany({});
  
  console.log('  - 장비 삭제 중...');
  await prisma.equipment.deleteMany({});
  
  console.log('  - 파티 초대 삭제 중...');
  await prisma.partyInvite.deleteMany({});
  
  console.log('  - 파티 멤버 삭제 중...');
  await prisma.partyMember.deleteMany({});
  
  console.log('  - 파티 삭제 중...');
  await prisma.party.deleteMany({});
  
  console.log('  - 전투 삭제 중...');
  await prisma.encounter.deleteMany({});
  
  console.log('  - 채팅 메시지 삭제 중...');
  await prisma.chatMessage.deleteMany({});
  
  console.log('  - 신고 삭제 중...');
  await prisma.report.deleteMany({});
  
  console.log('  - 제재 삭제 중...');
  await prisma.punishment.deleteMany({});
  
  console.log('  - 캐릭터 삭제 중...');
  await prisma.character.deleteMany({});
  
  console.log('  - 사용자 삭제 중...');
  await prisma.user.deleteMany({});
  
  console.log('✅ 데이터베이스 초기화 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

