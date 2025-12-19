import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 룸 데이터 생성
async function seedRooms() {
  console.log('Creating rooms...');
  
  const rooms: Array<{
    id: string;
    name: string;
    description: string;
    type: 'CITY' | 'DUNGEON';
    floor: number | null;
  }> = [];

  // 도시 룸 10개 (GH_*)
  const cityNames = [
    '그레이하버 광장',
    '그레이하버 상점가',
    '그레이하버 여관',
    '그레이하버 대성당',
    '그레이하버 마법사 길드',
    '그레이하버 전사 길드',
    '그레이하버 항구',
    '그레이하버 시청',
    '그레이하버 연금술 연구소',
    '그레이하버 미궁 입구'
  ];

  const cityDescriptions = [
    '번화한 광장입니다. 여러 상인과 모험가들이 오고갑니다.',
    '다양한 상점들이 늘어서 있습니다. 필요한 물건을 구할 수 있을 것 같습니다.',
    '편안한 여관입니다. 휴식을 취하기 좋은 곳입니다.',
    '웅장한 대성당입니다. 신성한 기운이 느껴집니다.',
    '마법사들이 모이는 길드입니다. 마법 관련 정보를 얻을 수 있습니다.',
    '전사들이 모이는 길드입니다. 무기와 방어구를 구할 수 있습니다.',
    '바다를 향한 항구입니다. 배들이 정박해 있습니다.',
    '도시의 중심 건물입니다. 중요한 공지사항이 붙어 있습니다.',
    '연금술사들이 연구하는 곳입니다. 포션을 구할 수 있습니다.',
    '깊은 미궁으로 향하는 입구입니다. 어둡고 신비로운 기운이 느껴집니다.'
  ];

  for (let i = 0; i < 10; i++) {
    rooms.push({
      id: `GH_${String(i).padStart(2, '0')}`,
      name: cityNames[i],
      description: cityDescriptions[i],
      type: 'CITY',
      floor: null
    });
  }

  // 미궁 1층 20개 (R1_00 ~ R1_19)
  for (let i = 0; i < 20; i++) {
    rooms.push({
      id: `R1_${String(i).padStart(2, '0')}`,
      name: `미궁 1층 - 구역 ${i + 1}`,
      description: `어둡고 축축한 미궁의 복도입니다. 벽면에는 이상한 문양이 새겨져 있습니다.${i === 0 ? ' 입구에서 멀지 않은 곳입니다.' : ''}`,
      type: 'DUNGEON',
      floor: 1
    });
  }

  // 미궁 2층 20개 (R2_00 ~ R2_19)
  for (let i = 0; i < 20; i++) {
    rooms.push({
      id: `R2_${String(i).padStart(2, '0')}`,
      name: `미궁 2층 - 구역 ${i + 1}`,
      description: `더욱 깊고 위험한 미궁의 깊은 곳입니다. 공기가 무겁고 불길한 기운이 느껴집니다.${i === 0 ? ' 계단을 통해 내려온 곳입니다.' : ''}`,
      type: 'DUNGEON',
      floor: 2
    });
  }

  // 룸 생성
  for (const room of rooms) {
    await prisma.room.upsert({
      where: { id: room.id },
      update: room,
      create: room
    });
  }

  // 출구 생성
  console.log('Creating room exits...');
  
  // 도시 룸 연결 (순환 구조)
  for (let i = 0; i < 10; i++) {
    const next = (i + 1) % 10;
    await prisma.roomExit.upsert({
      where: {
        fromRoomId_direction: {
          fromRoomId: `GH_${String(i).padStart(2, '0')}`,
          direction: 'east'
        }
      },
      update: {
        toRoomId: `GH_${String(next).padStart(2, '0')}`
      },
      create: {
        fromRoomId: `GH_${String(i).padStart(2, '0')}`,
        toRoomId: `GH_${String(next).padStart(2, '0')}`,
        direction: 'east'
      }
    });
    
    await prisma.roomExit.upsert({
      where: {
        fromRoomId_direction: {
          fromRoomId: `GH_${String(next).padStart(2, '0')}`,
          direction: 'west'
        }
      },
      update: {
        toRoomId: `GH_${String(i).padStart(2, '0')}`
      },
      create: {
        fromRoomId: `GH_${String(next).padStart(2, '0')}`,
        toRoomId: `GH_${String(i).padStart(2, '0')}`,
        direction: 'west'
      }
    });
  }

  // 도시 마지막 룸에서 미궁 1층 첫 번째 룸으로
  await prisma.roomExit.upsert({
    where: {
      fromRoomId_direction: {
        fromRoomId: 'GH_09',
        direction: 'down'
      }
    },
    update: {
      toRoomId: 'R1_00'
    },
    create: {
      fromRoomId: 'GH_09',
      toRoomId: 'R1_00',
      direction: 'down'
    }
  });

  await prisma.roomExit.upsert({
    where: {
      fromRoomId_direction: {
        fromRoomId: 'R1_00',
        direction: 'up'
      }
    },
    update: {
      toRoomId: 'GH_09'
    },
    create: {
      fromRoomId: 'R1_00',
      toRoomId: 'GH_09',
      direction: 'up'
    }
  });

  // 미궁 1층 연결 (격자 구조)
  const directions1 = [
    { dir: 'north', offset: -4 },
    { dir: 'south', offset: 4 },
    { dir: 'east', offset: 1 },
    { dir: 'west', offset: -1 }
  ];

  for (let i = 0; i < 20; i++) {
    for (const { dir, offset } of directions1) {
      const target = i + offset;
      if (target >= 0 && target < 20) {
        await prisma.roomExit.upsert({
          where: {
            fromRoomId_direction: {
              fromRoomId: `R1_${String(i).padStart(2, '0')}`,
              direction: dir
            }
          },
          update: {
            toRoomId: `R1_${String(target).padStart(2, '0')}`
          },
          create: {
            fromRoomId: `R1_${String(i).padStart(2, '0')}`,
            toRoomId: `R1_${String(target).padStart(2, '0')}`,
            direction: dir
          }
        });
      }
    }
  }

  // 미궁 1층 마지막에서 미궁 2층 첫 번째로
  await prisma.roomExit.upsert({
    where: {
      fromRoomId_direction: {
        fromRoomId: 'R1_19',
        direction: 'down'
      }
    },
    update: {
      toRoomId: 'R2_00'
    },
    create: {
      fromRoomId: 'R1_19',
      toRoomId: 'R2_00',
      direction: 'down'
    }
  });

  await prisma.roomExit.upsert({
    where: {
      fromRoomId_direction: {
        fromRoomId: 'R2_00',
        direction: 'up'
      }
    },
    update: {
      toRoomId: 'R1_19'
    },
    create: {
      fromRoomId: 'R2_00',
      toRoomId: 'R1_19',
      direction: 'up'
    }
  });

  // 미궁 2층 연결 (격자 구조)
  for (let i = 0; i < 20; i++) {
    for (const { dir, offset } of directions1) {
      const target = i + offset;
      if (target >= 0 && target < 20) {
        await prisma.roomExit.upsert({
          where: {
            fromRoomId_direction: {
              fromRoomId: `R2_${String(i).padStart(2, '0')}`,
              direction: dir
            }
          },
          update: {
            toRoomId: `R2_${String(target).padStart(2, '0')}`
          },
          create: {
            fromRoomId: `R2_${String(i).padStart(2, '0')}`,
            toRoomId: `R2_${String(target).padStart(2, '0')}`,
            direction: dir
          }
        });
      }
    }
  }

  return rooms;
}

// 몬스터 생성
async function seedMonsters() {
  console.log('Creating monsters...');
  
  const monsters = [
    { name: '고블린', level: 1, hp: 30, mp: 10, str: 8, dex: 12, int: 5, vit: 6, expReward: 10 },
    { name: '오크', level: 3, hp: 60, mp: 15, str: 15, dex: 8, int: 4, vit: 12, expReward: 25 },
    { name: '스켈레톤', level: 5, hp: 80, mp: 20, str: 12, dex: 10, int: 6, vit: 10, expReward: 40 },
    { name: '다크 엘프', level: 7, hp: 100, mp: 50, str: 10, dex: 15, int: 18, vit: 8, expReward: 60 },
    { name: '미노타우로스', level: 10, hp: 200, mp: 30, str: 25, dex: 12, int: 8, vit: 20, expReward: 100 },
    { name: '리치', level: 15, hp: 300, mp: 150, str: 15, dex: 10, int: 25, vit: 15, expReward: 200 },
    { name: '드래곤', level: 20, hp: 500, mp: 200, str: 30, dex: 15, int: 20, vit: 25, expReward: 500 }
  ];

  const createdMonsters = [];
  for (const m of monsters) {
    const monster = await prisma.monster.upsert({
      where: { id: `MON_${m.name}` },
      update: m,
      create: {
        id: `MON_${m.name}`,
        ...m,
        description: `${m.name}입니다. 레벨 ${m.level}의 몬스터입니다.`
      }
    });
    createdMonsters.push(monster);
  }

  return createdMonsters;
}

// 아이템 생성
async function seedItems() {
  console.log('Creating items...');
  
  const items = [
    // 무기
    { name: '나무 검', type: 'WEAPON', rarity: 'COMMON', level: 1, strBonus: 2 },
    { name: '철 검', type: 'WEAPON', rarity: 'UNCOMMON', level: 5, strBonus: 5 },
    { name: '강철 검', type: 'WEAPON', rarity: 'RARE', level: 10, strBonus: 10 },
    { name: '마법 검', type: 'WEAPON', rarity: 'EPIC', level: 15, strBonus: 15, intBonus: 10 },
    { name: '전설의 검', type: 'WEAPON', rarity: 'LEGENDARY', level: 20, strBonus: 25, dexBonus: 10 },
    
    // 방어구
    { name: '천 갑옷', type: 'ARMOR', rarity: 'COMMON', level: 1, vitBonus: 2 },
    { name: '가죽 갑옷', type: 'ARMOR', rarity: 'UNCOMMON', level: 5, vitBonus: 5 },
    { name: '철 갑옷', type: 'ARMOR', rarity: 'RARE', level: 10, vitBonus: 10 },
    { name: '미스릴 갑옷', type: 'ARMOR', rarity: 'EPIC', level: 15, vitBonus: 15, dexBonus: 5 },
    { name: '드래곤 스케일 갑옷', type: 'ARMOR', rarity: 'LEGENDARY', level: 20, vitBonus: 25, hpBonus: 50 },
    
    // 장신구
    { name: '힘의 반지', type: 'ACCESSORY', rarity: 'UNCOMMON', level: 3, strBonus: 3 },
    { name: '민첩의 반지', type: 'ACCESSORY', rarity: 'UNCOMMON', level: 3, dexBonus: 3 },
    { name: '지능의 반지', type: 'ACCESSORY', rarity: 'UNCOMMON', level: 3, intBonus: 3 },
    { name: '체력의 반지', type: 'ACCESSORY', rarity: 'UNCOMMON', level: 3, vitBonus: 3 },
    { name: '전사의 목걸이', type: 'ACCESSORY', rarity: 'RARE', level: 10, strBonus: 8, vitBonus: 5 },
    { name: '마법사의 목걸이', type: 'ACCESSORY', rarity: 'RARE', level: 10, intBonus: 8, mpBonus: 30 },
    
    // 소비품
    { name: '체력 포션', type: 'CONSUMABLE', rarity: 'COMMON', level: 1 },
    { name: '마나 포션', type: 'CONSUMABLE', rarity: 'COMMON', level: 1 },
    { name: '고급 체력 포션', type: 'CONSUMABLE', rarity: 'UNCOMMON', level: 5 },
    { name: '고급 마나 포션', type: 'CONSUMABLE', rarity: 'UNCOMMON', level: 5 },
    
    // 퀘스트 아이템
    { name: '고블린의 이빨', type: 'QUEST', rarity: 'COMMON', level: 1 },
    { name: '오크의 팔찌', type: 'QUEST', rarity: 'COMMON', level: 3 },
    { name: '스켈레톤의 해골', type: 'QUEST', rarity: 'UNCOMMON', level: 5 },
    { name: '다크 엘프의 수정', type: 'QUEST', rarity: 'RARE', level: 7 },
    { name: '미노타우로스의 뿔', type: 'QUEST', rarity: 'RARE', level: 10 },
    { name: '리치의 영혼석', type: 'QUEST', rarity: 'EPIC', level: 15 },
    { name: '드래곤의 비늘', type: 'QUEST', rarity: 'LEGENDARY', level: 20 }
  ];

  const createdItems = [];
  for (const item of items) {
    const created = await prisma.item.upsert({
      where: { id: `ITEM_${item.name}` },
      update: item,
      create: {
        id: `ITEM_${item.name}`,
        ...item,
        description: `${item.name}입니다. ${item.type === 'WEAPON' ? '무기' : item.type === 'ARMOR' ? '방어구' : item.type === 'ACCESSORY' ? '장신구' : item.type === 'CONSUMABLE' ? '소비품' : '퀘스트 아이템'}입니다.`
      }
    });
    createdItems.push(created);
  }

  return createdItems;
}

// 룸 스폰 설정
async function seedSpawns(monsters: any[], rooms: any[]) {
  console.log('Creating room spawns...');
  
  // 도시에는 스폰 없음
  // 미궁 1층: 고블린, 오크, 스켈레톤
  const dungeon1Monsters = monsters.filter(m => ['고블린', '오크', '스켈레톤'].includes(m.name));
  for (let i = 0; i < 20; i++) {
    for (const monster of dungeon1Monsters) {
      await prisma.roomSpawn.upsert({
        where: {
          roomId_monsterId: {
            roomId: `R1_${String(i).padStart(2, '0')}`,
            monsterId: monster.id
          }
        },
        update: {
          weight: monster.name === '고블린' ? 50 : monster.name === '오크' ? 30 : 20
        },
        create: {
          roomId: `R1_${String(i).padStart(2, '0')}`,
          monsterId: monster.id,
          weight: monster.name === '고블린' ? 50 : monster.name === '오크' ? 30 : 20
        }
      });
    }
  }

  // 미궁 2층: 다크 엘프, 미노타우로스, 리치, 드래곤
  const dungeon2Monsters = monsters.filter(m => ['다크 엘프', '미노타우로스', '리치', '드래곤'].includes(m.name));
  for (let i = 0; i < 20; i++) {
    for (const monster of dungeon2Monsters) {
      await prisma.roomSpawn.upsert({
        where: {
          roomId_monsterId: {
            roomId: `R2_${String(i).padStart(2, '0')}`,
            monsterId: monster.id
          }
        },
        update: {
          weight: monster.name === '다크 엘프' ? 40 : monster.name === '미노타우로스' ? 30 : monster.name === '리치' ? 20 : 10
        },
        create: {
          roomId: `R2_${String(i).padStart(2, '0')}`,
          monsterId: monster.id,
          weight: monster.name === '다크 엘프' ? 40 : monster.name === '미노타우로스' ? 30 : monster.name === '리치' ? 20 : 10
        }
      });
    }
  }
}

// 몬스터 드롭 설정
async function seedDrops(monsters: any[], items: any[]) {
  console.log('Creating monster drops...');
  
  const dropMap: Record<string, Array<{ item: string; rate: number; min: number; max: number }>> = {
    '고블린': [
      { item: '나무 검', rate: 0.1, min: 1, max: 1 },
      { item: '고블린의 이빨', rate: 0.5, min: 1, max: 2 },
      { item: '체력 포션', rate: 0.3, min: 1, max: 1 }
    ],
    '오크': [
      { item: '철 검', rate: 0.15, min: 1, max: 1 },
      { item: '오크의 팔찌', rate: 0.4, min: 1, max: 1 },
      { item: '체력 포션', rate: 0.4, min: 1, max: 2 }
    ],
    '스켈레톤': [
      { item: '가죽 갑옷', rate: 0.2, min: 1, max: 1 },
      { item: '스켈레톤의 해골', rate: 0.5, min: 1, max: 1 },
      { item: '마나 포션', rate: 0.3, min: 1, max: 1 }
    ],
    '다크 엘프': [
      { item: '강철 검', rate: 0.2, min: 1, max: 1 },
      { item: '다크 엘프의 수정', rate: 0.6, min: 1, max: 1 },
      { item: '지능의 반지', rate: 0.15, min: 1, max: 1 }
    ],
    '미노타우로스': [
      { item: '철 갑옷', rate: 0.25, min: 1, max: 1 },
      { item: '미노타우로스의 뿔', rate: 0.7, min: 1, max: 1 },
      { item: '힘의 반지', rate: 0.2, min: 1, max: 1 }
    ],
    '리치': [
      { item: '마법 검', rate: 0.3, min: 1, max: 1 },
      { item: '리치의 영혼석', rate: 0.8, min: 1, max: 1 },
      { item: '마법사의 목걸이', rate: 0.15, min: 1, max: 1 }
    ],
    '드래곤': [
      { item: '전설의 검', rate: 0.4, min: 1, max: 1 },
      { item: '드래곤 스케일 갑옷', rate: 0.4, min: 1, max: 1 },
      { item: '드래곤의 비늘', rate: 1.0, min: 1, max: 3 }
    ]
  };

  for (const monster of monsters) {
    const drops = dropMap[monster.name] || [];
    for (const drop of drops) {
      const item = items.find(i => i.name === drop.item);
      if (item) {
        await prisma.monsterDrop.upsert({
          where: {
            monsterId_itemId: {
              monsterId: monster.id,
              itemId: item.id
            }
          },
          update: {
            dropRate: drop.rate,
            minCount: drop.min,
            maxCount: drop.max
          },
          create: {
            monsterId: monster.id,
            itemId: item.id,
            dropRate: drop.rate,
            minCount: drop.min,
            maxCount: drop.max
          }
        });
      }
    }
  }
}

// 퀘스트 생성
async function seedQuests(monsters: any[], items: any[]) {
  console.log('Creating quests...');
  
  const quests = [
    {
      name: '고블린 퇴치',
      description: '고블린 10마리를 처치하세요.',
      type: 'KILL_MONSTER',
      targetId: monsters.find(m => m.name === '고블린')?.id,
      targetCount: 10,
      rewardExp: 100,
      rewardItemId: items.find(i => i.name === '철 검')?.id
    },
    {
      name: '오크 퇴치',
      description: '오크 5마리를 처치하세요.',
      type: 'KILL_MONSTER',
      targetId: monsters.find(m => m.name === '오크')?.id,
      targetCount: 5,
      rewardExp: 150,
      rewardItemId: items.find(i => i.name === '가죽 갑옷')?.id
    },
    {
      name: '스켈레톤 퇴치',
      description: '스켈레톤 3마리를 처치하세요.',
      type: 'KILL_MONSTER',
      targetId: monsters.find(m => m.name === '스켈레톤')?.id,
      targetCount: 3,
      rewardExp: 200,
      rewardItemId: items.find(i => i.name === '힘의 반지')?.id
    },
    {
      name: '고블린의 이빨 수집',
      description: '고블린의 이빨 20개를 수집하세요.',
      type: 'COLLECT_ITEM',
      targetId: items.find(i => i.name === '고블린의 이빨')?.id,
      targetCount: 20,
      rewardExp: 150,
      rewardItemId: items.find(i => i.name === '고급 체력 포션')?.id
    },
    {
      name: '오크의 팔찌 수집',
      description: '오크의 팔찌 10개를 수집하세요.',
      type: 'COLLECT_ITEM',
      targetId: items.find(i => i.name === '오크의 팔찌')?.id,
      targetCount: 10,
      rewardExp: 200,
      rewardItemId: items.find(i => i.name === '고급 마나 포션')?.id
    },
    {
      name: '미궁 1층 탐험',
      description: '미궁 1층의 모든 구역을 탐험하세요.',
      type: 'REACH_ROOM',
      targetId: 'R1_19',
      targetCount: 1,
      rewardExp: 300,
      rewardItemId: items.find(i => i.name === '강철 검')?.id
    },
    {
      name: '다크 엘프 퇴치',
      description: '다크 엘프 3마리를 처치하세요.',
      type: 'KILL_MONSTER',
      targetId: monsters.find(m => m.name === '다크 엘프')?.id,
      targetCount: 3,
      rewardExp: 300,
      rewardItemId: items.find(i => i.name === '미스릴 갑옷')?.id
    },
    {
      name: '미노타우로스 퇴치',
      description: '미노타우로스 2마리를 처치하세요.',
      type: 'KILL_MONSTER',
      targetId: monsters.find(m => m.name === '미노타우로스')?.id,
      targetCount: 2,
      rewardExp: 400,
      rewardItemId: items.find(i => i.name === '전사의 목걸이')?.id
    },
    {
      name: '리치 퇴치',
      description: '리치 1마리를 처치하세요.',
      type: 'KILL_MONSTER',
      targetId: monsters.find(m => m.name === '리치')?.id,
      targetCount: 1,
      rewardExp: 500,
      rewardItemId: items.find(i => i.name === '마법 검')?.id
    },
    {
      name: '드래곤 퇴치',
      description: '드래곤 1마리를 처치하세요.',
      type: 'KILL_MONSTER',
      targetId: monsters.find(m => m.name === '드래곤')?.id,
      targetCount: 1,
      rewardExp: 1000,
      rewardItemId: items.find(i => i.name === '전설의 검')?.id
    }
  ];

  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    await prisma.quest.upsert({
      where: { id: `QUEST_${String(i + 1).padStart(2, '0')}` },
      update: quest,
      create: {
        id: `QUEST_${String(i + 1).padStart(2, '0')}`,
        ...quest
      }
    });
  }
}

// JSON 파일로 저장
async function saveToJson(rooms: any[], monsters: any[], items: any[]) {
  const contentDir = path.join(process.cwd(), 'src', 'content');
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(contentDir, 'rooms.json'),
    JSON.stringify(rooms, null, 2),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(contentDir, 'monsters.json'),
    JSON.stringify(monsters, null, 2),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(contentDir, 'items.json'),
    JSON.stringify(items, null, 2),
    'utf-8'
  );

  console.log('Content files saved to src/content/');
}

async function main() {
  console.log('Starting seed...');
  
  const rooms = await seedRooms();
  const monsters = await seedMonsters();
  const items = await seedItems();
  
  await seedSpawns(monsters, rooms);
  await seedDrops(monsters, items);
  await seedQuests(monsters, items);
  
  await saveToJson(rooms, monsters, items);
  
  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

