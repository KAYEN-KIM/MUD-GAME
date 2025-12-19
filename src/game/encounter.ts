import { PrismaClient } from '@prisma/client';
import { PartySpeedMode } from '@prisma/client';
import { getPartyInfo } from './party';

const prisma = new PrismaClient();

export interface EncounterParticipantData {
  id: string;
  name: string;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  str: number;
  dex: number;
  int: number;
  vit: number;
  level: number;
}

export async function createEncounter(
  roomId: string,
  partyId: string | null,
  speedMode: PartySpeedMode
): Promise<string> {
  // 룸의 스폰 정보 조회
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      spawns: {
        include: {
          monster: true
        }
      }
    }
  });

  if (!room || room.spawns.length === 0) {
    throw new Error('이 룸에서는 몬스터를 만날 수 없습니다.');
  }

  // 가중치 기반 랜덤 몬스터 선택
  const totalWeight = room.spawns.reduce((sum, spawn) => sum + spawn.weight, 0);
  let random = Math.random() * totalWeight;
  
  let selectedSpawn = room.spawns[0];
  for (const spawn of room.spawns) {
    random -= spawn.weight;
    if (random <= 0) {
      selectedSpawn = spawn;
      break;
    }
  }

  const monster = selectedSpawn.monster;

  // 인카운터 생성
  const turnDuration = speedMode === 'FAST' ? 6000 : 9000;
  const turnEndsAt = new Date(Date.now() + turnDuration);

  const encounter = await prisma.encounter.create({
    data: {
      partyId,
      roomId,
      speedMode,
      turnEndsAt,
      status: 'ACTIVE'
    }
  });

  // 플레이어 참가자 추가
  if (partyId) {
    const party = await getPartyInfo(partyId);
    if (party) {
      for (const member of party.members) {
        const character = await prisma.character.findUnique({
          where: { id: member.characterId }
        });

        if (character) {
          await prisma.encounterParticipant.create({
            data: {
              encounterId: encounter.id,
              characterId: character.id,
              isPlayer: true,
              hp: character.hp,
              maxHp: character.maxHp,
              mp: character.mp,
              maxMp: character.maxMp
            }
          });
        }
      }
    }
  } else {
    // 솔로 플레이어 (나중에 구현)
    throw new Error('솔로 인카운터는 아직 지원하지 않습니다.');
  }

  // 몬스터 참가자 추가
  await prisma.encounterParticipant.create({
    data: {
      encounterId: encounter.id,
      monsterId: monster.id,
      isPlayer: false,
      hp: monster.hp,
      maxHp: monster.maxHp,
      mp: monster.mp,
      maxMp: monster.maxMp
    }
  });

  return encounter.id;
}

export async function getEncounter(encounterId: string) {
  return prisma.encounter.findUnique({
    where: { id: encounterId },
    include: {
      participants: {
        include: {
          character: {
            select: {
              id: true,
              name: true,
              level: true,
              str: true,
              dex: true,
              int: true,
              vit: true
            }
          },
          monster: {
            select: {
              id: true,
              name: true,
              level: true,
              str: true,
              dex: true,
              int: true,
              vit: true
            }
          }
        }
      }
    }
  });
}

