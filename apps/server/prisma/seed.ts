import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 룸 생성 (50개)
async function seedRooms() {
  console.log('🏰 룸 생성 중...');

  const rooms = [];

  // 도시 룸 10개 (SAFE 태그 추가)
  const cityRooms = [
    { id: 'START_TOWN', name: '그레이하버 - 시작 마을', description: '모험가들이 모이는 작은 마을입니다. 북쪽으로 빈민가, 동쪽으로 미궁 입구가 보입니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_GATE', name: '그레이하버 - 대문', description: '도시의 정문입니다. 높은 성벽이 도시를 지키고 있습니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_GUILDHALL', name: '그레이하버 - 길드홀', description: '모험가들이 모이는 길드홀입니다. 의뢰 게시판이 보입니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_INN', name: '그레이하버 - 여관', description: '편안한 휴식처입니다. 숙박과 식사를 제공합니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_TEMPLE', name: '그레이하버 - 신전', description: '신성한 기운이 감도는 곳입니다. 치유를 받을 수 있습니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_MARKET', name: '그레이하버 - 시장', description: '활기찬 시장입니다. 다양한 물건을 사고 팔 수 있습니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_BLACKSMITH', name: '그레이하버 - 대장간', description: '대장간의 불길이 타오릅니다. 무기와 방어구를 제작합니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_APPRAISER', name: '그레이하버 - 감정소', description: '아이템을 감정하고 평가하는 곳입니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_DOCKS', name: '그레이하버 - 부두', description: '바다가 보이는 항구입니다. 배들이 정박해 있습니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_SLUMS', name: '그레이하버 - 빈민가', description: '어두운 골목길입니다. 위험한 기운이 느껴집니다.', region: 'city', tags: [], zoneId: 'CITY', depth: 0, dangerLevel: 1, recommendedLevel: 1 },
    { id: 'GH_RIFT_OUTPOST', name: '그레이하버 - 균열 전초기지', description: '미궁으로 향하는 입구입니다. 경비병들이 지키고 있습니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_LEDGER_OFFICE', name: '그레이하버 - 원장 사무소', description: '시즌 퀘스트와 보상을 관리하는 사무소입니다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
    { id: 'GH_TROPHY_HALL_S1', name: '전리품 전당 (S1)', description: '보스 트로피를 기념품으로 교환하는 장소다.', region: 'city', tags: ['SAFE'], zoneId: 'CITY', depth: 0, dangerLevel: 0, recommendedLevel: 1 },
  ];

  rooms.push(...cityRooms);

  // 미궁 1층 20개 (5x4 격자) - dangerLevel 구분
  for (let i = 0; i < 20; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const depth = row + col;
    const dangerLevel = Math.min(3, Math.floor(depth / 2) + 1); // 1~3
    const recommendedLevel = dangerLevel;

    rooms.push({
      id: `R1_${String(i).padStart(2, '0')}`,
      name: `미궁 1층 - ${row + 1}구역 ${col + 1}번`,
      description: `어둡고 축축한 미궁의 통로입니다. 벽면에는 이상한 문양이 새겨져 있습니다.`,
      region: 'dungeon1',
      tags: [],
      zoneId: 'R1',
      depth,
      dangerLevel,
      recommendedLevel,
    });
  }

  // 미궁 1층 - 보스룸 (R1_BOSS_RESIDUE)
  rooms.push({
    id: 'R1_BOSS_RESIDUE',
    name: '잔재 브로커의 작업장',
    description: '불안정한 균열의 기운이 감도는 작업장입니다. 잔재 브로커가 이곳에서 활동한 흔적이 남아있습니다.',
    region: 'dungeon1',
    tags: ['BOSS'],
    zoneId: 'R1',
    depth: 2,
    dangerLevel: 3,
    recommendedLevel: 3,
  });

  // 시즌2: 연무의 도서 (R2) - 7개 방
  const s2Rooms = [
    {
      id: 'R2_00',
      name: '연무의 도서 - 입구',
      description: '안개가 자욱한 도서관 입구입니다. 책장 사이로 희미한 불빛이 보입니다.',
      recommendedLevel: 13,
      dangerLevel: 4,
      depth: 20,
    },
    {
      id: 'R2_01',
      name: '연무의 도서 - 고문서 구역',
      description: '먼지 쌓인 고문서들이 가득합니다. 페이지에서 이상한 기운이 흐릅니다.',
      recommendedLevel: 13,
      dangerLevel: 4,
      depth: 21,
    },
    {
      id: 'R2_02',
      name: '연무의 도서 - 금서 서가',
      description: '금지된 지식이 담긴 서적들이 보관된 구역입니다. 잉크 냄새가 진하게 납니다.',
      recommendedLevel: 14,
      dangerLevel: 4,
      depth: 22,
    },
    {
      id: 'R2_03',
      name: '연무의 도서 - 필사실',
      description: '서기들이 작업하던 필사실입니다. 책상 위에 미완성 원고가 널려있습니다.',
      recommendedLevel: 14,
      dangerLevel: 4,
      depth: 23,
    },
    {
      id: 'R2_04',
      name: '연무의 도서 - 연구실',
      description: '낡은 연구 기록들이 흩어진 공간입니다. 실험 도구들이 여기저기 보입니다.',
      recommendedLevel: 15,
      dangerLevel: 5,
      depth: 24,
    },
    {
      id: 'R2_05',
      name: '연무의 도서 - 심층 통로',
      description: '서고 깊은 곳으로 향하는 좁은 통로입니다. 앞쪽에서 강한 기운이 느껴집니다.',
      recommendedLevel: 16,
      dangerLevel: 5,
      depth: 25,
    },
    {
      id: 'R2_BOSS_TOME',
      name: '연무의 서고 심층',
      description: '도서관의 가장 깊은 곳. 서고의 파수꾼이 오래된 서적을 지키고 있습니다.',
      recommendedLevel: 18,
      dangerLevel: 5,
      depth: 30,
      tags: ['BOSS'],
    },
  ];

  for (const s2Room of s2Rooms) {
    rooms.push({
      ...s2Room,
      region: 'season2',
      zoneId: 'R2',
      tags: s2Room.tags || [],
    });
  }

  // DB에 저장
  for (const room of rooms) {
    await prisma.room.upsert({
      where: { id: room.id },
      update: room,
      create: room,
    });
  }

  console.log(`✅ 룸 ${rooms.length}개 생성 완료`);
  return rooms;
}

// 출구 생성
async function seedExits() {
  console.log('🚪 출구 생성 중...');

  const exits: Array<{ fromRoomId: string; toRoomId: string; label: string }> = [];

  // START_TOWN 출구 (최소 2개 보장)
  // START_TOWN --N--> GH_SLUMS (huntable=true)
  exits.push({ fromRoomId: 'START_TOWN', toRoomId: 'GH_SLUMS', label: '빈민가로' });
  exits.push({ fromRoomId: 'GH_SLUMS', toRoomId: 'START_TOWN', label: '시작 마을로' });
  // START_TOWN --E--> R1_00 (huntable=true)
  exits.push({ fromRoomId: 'START_TOWN', toRoomId: 'R1_00', label: '미궁으로' });
  exits.push({ fromRoomId: 'R1_00', toRoomId: 'START_TOWN', label: '시작 마을로' });
  // START_TOWN --W--> GH_GATE
  exits.push({ fromRoomId: 'START_TOWN', toRoomId: 'GH_GATE', label: '대문으로' });
  exits.push({ fromRoomId: 'GH_GATE', toRoomId: 'START_TOWN', label: '시작 마을로' });

  // 도시 내부 연결 (시장 중심)
  const cityConnections = [
    ['GH_GATE', 'GH_MARKET', '시장으로'],
    ['GH_MARKET', 'GH_GATE', '대문으로'],
    ['GH_MARKET', 'GH_GUILDHALL', '길드홀로'],
    ['GH_GUILDHALL', 'GH_MARKET', '시장으로'],
    ['GH_MARKET', 'GH_INN', '여관으로'],
    ['GH_INN', 'GH_MARKET', '시장으로'],
    ['GH_MARKET', 'GH_TEMPLE', '신전으로'],
    ['GH_TEMPLE', 'GH_MARKET', '시장으로'],
    ['GH_MARKET', 'GH_BLACKSMITH', '대장간으로'],
    ['GH_BLACKSMITH', 'GH_MARKET', '시장으로'],
    ['GH_MARKET', 'GH_APPRAISER', '감정소로'],
    ['GH_APPRAISER', 'GH_MARKET', '시장으로'],
    ['GH_MARKET', 'GH_DOCKS', '부두로'],
    ['GH_DOCKS', 'GH_MARKET', '시장으로'],
    ['GH_GATE', 'GH_SLUMS', '빈민가로'],
    ['GH_SLUMS', 'GH_GATE', '대문으로'],
    ['GH_GATE', 'GH_RIFT_OUTPOST', '균열 전초기지로'],
    ['GH_RIFT_OUTPOST', 'GH_GATE', '대문으로'],
    ['GH_MARKET', 'GH_LEDGER_OFFICE', '원장 사무소로'],
    ['GH_LEDGER_OFFICE', 'GH_MARKET', '시장으로'],
    ['GH_LEDGER_OFFICE', 'GH_TROPHY_HALL_S1', '전리품 전당으로'],
    ['GH_TROPHY_HALL_S1', 'GH_LEDGER_OFFICE', '원장 사무소로'],
  ];

  for (const [from, to, label] of cityConnections) {
    exits.push({ fromRoomId: from, toRoomId: to, label });
  }

  // 도시 - 미궁 1층 연결
  exits.push({ fromRoomId: 'GH_RIFT_OUTPOST', toRoomId: 'R1_00', label: '미궁으로' });
  exits.push({ fromRoomId: 'R1_00', toRoomId: 'GH_RIFT_OUTPOST', label: '도시로' });

  // 미궁 1층 격자 연결 (5x4)
  for (let i = 0; i < 20; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;

    // 북쪽
    if (row > 0) {
      exits.push({
        fromRoomId: `R1_${String(i).padStart(2, '0')}`,
        toRoomId: `R1_${String(i - 5).padStart(2, '0')}`,
        label: '북쪽',
      });
    }

    // 남쪽
    if (row < 3) {
      exits.push({
        fromRoomId: `R1_${String(i).padStart(2, '0')}`,
        toRoomId: `R1_${String(i + 5).padStart(2, '0')}`,
        label: '남쪽',
      });
    }

    // 서쪽
    if (col > 0) {
      exits.push({
        fromRoomId: `R1_${String(i).padStart(2, '0')}`,
        toRoomId: `R1_${String(i - 1).padStart(2, '0')}`,
        label: '서쪽',
      });
    }

    // 동쪽
    if (col < 4) {
      exits.push({
        fromRoomId: `R1_${String(i).padStart(2, '0')}`,
        toRoomId: `R1_${String(i + 1).padStart(2, '0')}`,
        label: '동쪽',
      });
    }
  }

  // 미궁 1층 - 보스룸 연결 (R1_06 <-> R1_BOSS_RESIDUE)
  exits.push({ fromRoomId: 'R1_06', toRoomId: 'R1_BOSS_RESIDUE', label: '작업장으로' });
  exits.push({ fromRoomId: 'R1_BOSS_RESIDUE', toRoomId: 'R1_06', label: '복도로' });

  // 시즌2: 연무의 도서 (R2) 연결 - 선형 + 보스방
  // GH_RIFT_OUTPOST <-> R2_00 (새 진입로)
  exits.push({ fromRoomId: 'GH_RIFT_OUTPOST', toRoomId: 'R2_00', label: '연무의 도서로' });
  exits.push({ fromRoomId: 'R2_00', toRoomId: 'GH_RIFT_OUTPOST', label: '도시로' });

  // R2 내부 선형 연결 (방향 있음)
  exits.push({ fromRoomId: 'R2_00', toRoomId: 'R2_01', label: '동쪽' });
  exits.push({ fromRoomId: 'R2_01', toRoomId: 'R2_00', label: '서쪽' });

  exits.push({ fromRoomId: 'R2_01', toRoomId: 'R2_02', label: '동쪽' });
  exits.push({ fromRoomId: 'R2_02', toRoomId: 'R2_01', label: '서쪽' });

  exits.push({ fromRoomId: 'R2_02', toRoomId: 'R2_03', label: '남쪽' });
  exits.push({ fromRoomId: 'R2_03', toRoomId: 'R2_02', label: '북쪽' });

  exits.push({ fromRoomId: 'R2_03', toRoomId: 'R2_04', label: '남쪽' });
  exits.push({ fromRoomId: 'R2_04', toRoomId: 'R2_03', label: '북쪽' });

  exits.push({ fromRoomId: 'R2_04', toRoomId: 'R2_05', label: '서쪽' });
  exits.push({ fromRoomId: 'R2_05', toRoomId: 'R2_04', label: '동쪽' });

  // R2_05 -> R2_BOSS_TOME (보스방)
  exits.push({ fromRoomId: 'R2_05', toRoomId: 'R2_BOSS_TOME', label: '남쪽' });
  exits.push({ fromRoomId: 'R2_BOSS_TOME', toRoomId: 'R2_05', label: '북쪽' });


  // DB에 저장 (전체 교체 방식으로 결정적 시딩)
  console.log(`  출구 ${exits.length}개 정리 완료, DB에 반영 중...`);
  
  await prisma.$transaction(async (tx) => {
    // 1. 기존 RoomExit 전체 삭제
    await tx.roomExit.deleteMany({});
    
    // 2. 새 RoomExit 일괄 생성
    await tx.roomExit.createMany({
      data: exits,
      skipDuplicates: true,
    });
    
    // 3. 검증 (개수 확인)
    const count = await tx.roomExit.count();
    console.log(`  ✅ RoomExit ${count}개 생성 완료 (기대: ${exits.length})`);
    
    if (count !== exits.length) {
      console.warn(`  ⚠️  생성된 개수가 기대값과 다릅니다!`);
    }
  });

}

// 캐릭터 위치 교정 (START_TOWN으로 이동)
async function correctCharacterLocations() {
  console.log('📍 캐릭터 위치 교정 중...');
  
  const characters = await prisma.character.findMany({
    where: {
      roomId: {
        not: 'START_TOWN',
      },
    },
  });

  if (characters.length > 0) {
    await prisma.character.updateMany({
      where: {
        roomId: {
          not: 'START_TOWN',
        },
      },
      data: {
        roomId: 'START_TOWN',
      },
    });
    console.log(`✅ ${characters.length}개 캐릭터를 START_TOWN으로 이동`);
  } else {
    console.log('✅ 모든 캐릭터가 START_TOWN에 있습니다.');
  }
}

// 몬스터 생성 (17종: 기본 12 + S1 보스 1 + S2 일반 3 + S2 보스 1)
async function seedMonsters() {
  console.log('👹 몬스터 생성 중...');

  const monsters = [
    { id: 'MON_RAT', name: '쥐', level: 1, hp: 20, atk: 5, def: 2, aiJson: { behavior: 'passive' } },
    { id: 'MON_GOBLIN', name: '고블린', level: 2, hp: 40, atk: 8, def: 4, aiJson: { behavior: 'aggressive' } },
    { id: 'MON_WOLF', name: '늑대', level: 3, hp: 60, atk: 12, def: 6, aiJson: { behavior: 'aggressive' } },
    { id: 'MON_ORC', name: '오크', level: 4, hp: 100, atk: 15, def: 10, aiJson: { behavior: 'aggressive' } },
    { id: 'MON_SKELETON', name: '스켈레톤', level: 5, hp: 80, atk: 18, def: 8, aiJson: { behavior: 'aggressive' } },
    { id: 'MON_ZOMBIE', name: '좀비', level: 5, hp: 120, atk: 10, def: 12, aiJson: { behavior: 'slow' } },
    { id: 'MON_SPIDER', name: '거미', level: 6, hp: 90, atk: 20, def: 7, aiJson: { behavior: 'ambush' } },
    { id: 'MON_BANDIT', name: '산적', level: 7, hp: 150, atk: 22, def: 15, aiJson: { behavior: 'tactical' } },
    { id: 'MON_GOLEM', name: '골렘', level: 8, hp: 200, atk: 25, def: 20, aiJson: { behavior: 'defensive' } },
    { id: 'MON_VAMPIRE', name: '뱀파이어', level: 10, hp: 250, atk: 30, def: 18, aiJson: { behavior: 'lifesteal' } },
    { id: 'MON_DEMON', name: '악마', level: 12, hp: 300, atk: 35, def: 25, aiJson: { behavior: 'aggressive' } },
    { id: 'MON_DRAGON', name: '드래곤', level: 15, hp: 500, atk: 50, def: 40, aiJson: { behavior: 'boss' } },
    // S1 보스
    { id: 'BOSS_RESIDUE_BROKER', name: '잔재 브로커', level: 10, hp: 200, atk: 20, def: 15, aiJson: { behavior: 'boss' } },
    // S2 몬스터
    { id: 'M_S2_FOG_SCRIBE', name: '안개 서기', level: 13, hp: 320, atk: 38, def: 28, aiJson: { behavior: 'aggressive' } },
    { id: 'M_S2_PAGE_WRAITH', name: '페이지 망령', level: 14, hp: 280, atk: 42, def: 24, aiJson: { behavior: 'ambush' } },
    { id: 'M_S2_INK_LEECH', name: '잉크 거머리', level: 15, hp: 340, atk: 40, def: 30, aiJson: { behavior: 'lifesteal' } },
    // S2 보스
    { id: 'BOSS_TOME_WARDEN', name: '서고의 파수꾼', level: 18, hp: 450, atk: 45, def: 35, aiJson: { behavior: 'boss' } },
  ];

  for (const monster of monsters) {
    await prisma.monster.upsert({
      where: { id: monster.id },
      update: monster,
      create: monster,
    });
  }

  console.log(`✅ 몬스터 ${monsters.length}개 생성 완료`);
  return monsters;
}

// 룸 스폰 테이블 생성
async function seedSpawns(monsters: any[]) {
  console.log('🎲 스폰 테이블 생성 중...');

  const spawns = [];

  // 빈민가
  spawns.push({ roomId: 'GH_SLUMS', monsterId: 'MON_RAT', weight: 70 });
  spawns.push({ roomId: 'GH_SLUMS', monsterId: 'MON_BANDIT', weight: 30 });

  // 미궁 1층
  const dungeon1Monsters = ['MON_GOBLIN', 'MON_WOLF', 'MON_SKELETON', 'MON_SPIDER'];
  for (let i = 0; i < 20; i++) {
    for (const monsterId of dungeon1Monsters) {
      spawns.push({
        roomId: `R1_${String(i).padStart(2, '0')}`,
        monsterId,
        weight: 25,
      });
    }
  }

  // 시즌2: 연무의 도서 (R2_00 ~ R2_05)
  const s2Monsters = ['M_S2_FOG_SCRIBE', 'M_S2_PAGE_WRAITH', 'M_S2_INK_LEECH'];
  const s2Rooms = ['R2_00', 'R2_01', 'R2_02', 'R2_03', 'R2_04', 'R2_05'];
  for (const roomId of s2Rooms) {
    for (const monsterId of s2Monsters) {
      spawns.push({
        roomId,
        monsterId,
        weight: 33,
      });
    }
  }
  // R2_BOSS_TOME는 보스방이므로 일반 스폰 없음

  // DB에 저장
  for (const spawn of spawns) {
    await prisma.roomSpawn.upsert({
      where: {
        roomId_monsterId: {
          roomId: spawn.roomId,
          monsterId: spawn.monsterId,
        },
      },
      update: { weight: spawn.weight },
      create: spawn,
    });
  }

  console.log(`✅ 스폰 ${spawns.length}개 생성 완료`);
}

// 아이템 생성 (items.json에서 로드)
async function seedItems() {
  console.log('⚔️ 아이템 생성 중...');

  // items.json 로드 (__dirname 기준으로 올바른 상대 경로)
  const itemsJsonPath = path.join(__dirname, '..', 'src', 'content', 'items.json');
  console.log(`  - Loading items from: ${itemsJsonPath}`);
  
  const itemsData = JSON.parse(fs.readFileSync(itemsJsonPath, 'utf-8'));

  for (const item of itemsData) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  console.log(`✅ 아이템 ${itemsData.length}개 생성 완료`);
  return itemsData;
}

// 드롭 테이블 생성
async function seedDrops(monsters: any[], items: any[]) {
  console.log('💎 드롭 테이블 생성 중...');

  const drops = [
    // 쥐
    { monsterId: 'MON_RAT', itemId: 'ITEM_MAT_LEATHER', minQty: 1, maxQty: 2, chanceBp: 5000 },
    { monsterId: 'MON_RAT', itemId: 'ITEM_POTION_HP_S', minQty: 1, maxQty: 1, chanceBp: 2000 },
    
    // 고블린
    { monsterId: 'MON_GOBLIN', itemId: 'ITEM_MAT_CLOTH', minQty: 1, maxQty: 3, chanceBp: 6000 },
    { monsterId: 'MON_GOBLIN', itemId: 'ITEM_SWORD_WOOD', minQty: 1, maxQty: 1, chanceBp: 1000 },
    
    // 늑대
    { monsterId: 'MON_WOLF', itemId: 'ITEM_MAT_LEATHER', minQty: 2, maxQty: 4, chanceBp: 7000 },
    { monsterId: 'MON_WOLF', itemId: 'ITEM_POTION_HP_M', minQty: 1, maxQty: 1, chanceBp: 1500 },
    
    // 오크
    { monsterId: 'MON_ORC', itemId: 'ITEM_MAT_ORE_IRON', minQty: 1, maxQty: 2, chanceBp: 5000 },
    { monsterId: 'MON_ORC', itemId: 'ITEM_SWORD_IRON', minQty: 1, maxQty: 1, chanceBp: 800 },
    
    // 스켈레톤
    { monsterId: 'MON_SKELETON', itemId: 'ITEM_MAT_BONE', minQty: 2, maxQty: 5, chanceBp: 8000 },
    { monsterId: 'MON_SKELETON', itemId: 'ITEM_ARMOR_LEATHER', minQty: 1, maxQty: 1, chanceBp: 1000 },
    
    // 좀비
    { monsterId: 'MON_ZOMBIE', itemId: 'ITEM_MAT_CLOTH', minQty: 3, maxQty: 6, chanceBp: 6000 },
    
    // 거미
    { monsterId: 'MON_SPIDER', itemId: 'ITEM_POTION_HP_M', minQty: 1, maxQty: 2, chanceBp: 3000 },
    
    // 산적
    { monsterId: 'MON_BANDIT', itemId: 'ITEM_SWORD_IRON', minQty: 1, maxQty: 1, chanceBp: 2000 },
    { monsterId: 'MON_BANDIT', itemId: 'ITEM_ARMOR_CHAIN', minQty: 1, maxQty: 1, chanceBp: 500 },
    
    // 골렘
    { monsterId: 'MON_GOLEM', itemId: 'ITEM_MAT_ORE_MITHRIL', minQty: 1, maxQty: 2, chanceBp: 4000 },
    { monsterId: 'MON_GOLEM', itemId: 'ITEM_MAT_ESSENCE', minQty: 1, maxQty: 1, chanceBp: 1000 },
    
    // 뱀파이어
    { monsterId: 'MON_VAMPIRE', itemId: 'ITEM_MAT_ESSENCE', minQty: 2, maxQty: 3, chanceBp: 5000 },
    { monsterId: 'MON_VAMPIRE', itemId: 'ITEM_AMULET_HP', minQty: 1, maxQty: 1, chanceBp: 800 },
    
    // 악마
    { monsterId: 'MON_DEMON', itemId: 'ITEM_MAT_ESSENCE', minQty: 3, maxQty: 5, chanceBp: 7000 },
    { monsterId: 'MON_DEMON', itemId: 'ITEM_SWORD_MITHRIL', minQty: 1, maxQty: 1, chanceBp: 1000 },
    
    // 드래곤
    { monsterId: 'MON_DRAGON', itemId: 'ITEM_MAT_DRAGON_SCALE', minQty: 3, maxQty: 7, chanceBp: 10000 },
    { monsterId: 'MON_DRAGON', itemId: 'ITEM_SWORD_MITHRIL', minQty: 1, maxQty: 1, chanceBp: 5000 },
    { monsterId: 'MON_DRAGON', itemId: 'ITEM_ARMOR_PLATE', minQty: 1, maxQty: 1, chanceBp: 5000 },
  ];

  for (const drop of drops) {
    await prisma.monsterDrop.upsert({
      where: {
        monsterId_itemId: {
          monsterId: drop.monsterId,
          itemId: drop.itemId,
        },
      },
      update: drop,
      create: drop,
    });
  }

  console.log(`✅ 드롭 ${drops.length}개 생성 완료`);
}

// 퀘스트 생성 (10개)
async function seedQuests() {
  console.log('📜 퀘스트 생성 중...');

  // content/quests.json 로드
  const questsJsonPath = path.join(process.cwd(), '..', '..', 'apps', 'server', 'content', 'quests.json');
  let quests = [];

  if (fs.existsSync(questsJsonPath)) {
    const questsData = fs.readFileSync(questsJsonPath, 'utf-8');
    quests = JSON.parse(questsData);
    console.log(`  - content/quests.json에서 ${quests.length}개 로드`);
  } else {
    console.log(`  ⚠️  content/quests.json을 찾을 수 없습니다. 기본 퀘스트 3개만 생성합니다.`);
    quests = [
      {
        id: 'Q_EXPLORE_R1',
        title: '미궁 탐험',
        description: '미궁 1층 입구(R1_00)를 방문하세요.',
        giverRoomId: 'START_TOWN',
        turninRoomId: 'START_TOWN',
        minLevel: 1,
        repeatable: false,
        objectivesJson: [{ type: 'VISIT_ROOM', roomId: 'R1_00', count: 1 }],
        rewardsJson: { gold: 50, exp: 30, items: [] },
      },
      {
        id: 'Q_FIRST_BLOOD_R1',
        title: '첫 사냥',
        description: '미궁 1층(R1)에서 몬스터 3마리를 처치하세요.',
        giverRoomId: 'START_TOWN',
        turninRoomId: 'START_TOWN',
        minLevel: 1,
        repeatable: false,
        objectivesJson: [{ type: 'KILL_IN_ZONE', zoneId: 'R1', count: 3 }],
        rewardsJson: { gold: 100, exp: 80, items: [{ itemId: 'ITEM_POTION_HP_S', qty: 2 }] },
      },
      {
        id: 'Q_MARKET_POTION',
        title: '약초 수집가',
        description: '시장에서 물약을 1개 구매하거나 획득하세요.',
        giverRoomId: 'START_TOWN',
        turninRoomId: 'START_TOWN',
        minLevel: 1,
        repeatable: false,
        objectivesJson: [{ type: 'COLLECT_ITEM', itemId: 'ITEM_POTION_HP_S', count: 1 }],
        rewardsJson: { gold: 30, exp: 20, items: [] },
      },
    ];
  }

  for (const quest of quests) {
    await prisma.questTemplate.upsert({
      where: { id: quest.id },
      update: quest,
      create: quest,
    });
  }

  console.log(`✅ 퀘스트 ${quests.length}개 생성 완료`);
}

// JSON 파일로 저장 (선택사항)
async function saveToJson() {
  const contentDir = path.join(process.cwd(), 'src', 'content');
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }

  const rooms = await prisma.room.findMany();
  const monsters = await prisma.monster.findMany();
  const items = await prisma.item.findMany();
  const quests = await prisma.questTemplate.findMany();

  fs.writeFileSync(path.join(contentDir, 'rooms.json'), JSON.stringify(rooms, null, 2));
  fs.writeFileSync(path.join(contentDir, 'monsters.json'), JSON.stringify(monsters, null, 2));
  fs.writeFileSync(path.join(contentDir, 'items.json'), JSON.stringify(items, null, 2));
  fs.writeFileSync(path.join(contentDir, 'quests.json'), JSON.stringify(quests, null, 2));

  console.log('✅ JSON 파일 저장 완료 (src/content/)');
}

async function main() {
  console.log('🌱 시드 시작...\n');

  const rooms = await seedRooms();
  await seedExits();
  const monsters = await seedMonsters();
  await seedSpawns(monsters);
  const items = await seedItems();
  await seedDrops(monsters, items);
  await seedQuests();
  await correctCharacterLocations();
  await saveToJson();

  console.log('\n✨ 시드 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

