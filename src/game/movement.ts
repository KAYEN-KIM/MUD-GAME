import { PrismaClient } from '@prisma/client';
import { checkMoveRateLimit } from '../utils/rateLimit';
import { LogAppendPayload, StateSyncPayload } from '../types/messages';

const prisma = new PrismaClient();

export interface MoveResult {
  success: boolean;
  log?: LogAppendPayload;
  stateSync?: StateSyncPayload;
  error?: string;
}

export async function moveCharacter(
  characterId: string,
  direction: string
): Promise<MoveResult> {
  // 레이트 리밋 체크
  const rateLimit = await checkMoveRateLimit(characterId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: '이동 속도가 너무 빠릅니다. 잠시 후 다시 시도하세요.'
    };
  }

  // 캐릭터 정보 조회
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      currentRoom: {
        include: {
          exits: true
        }
      }
    }
  });

  if (!character) {
    return {
      success: false,
      error: '캐릭터를 찾을 수 없습니다.'
    };
  }

  // 출구 찾기
  const exit = character.currentRoom.exits.find(
    e => e.direction.toLowerCase() === direction.toLowerCase()
  );

  if (!exit) {
    return {
      success: false,
      log: {
        text: `${direction} 방향으로 갈 수 없습니다.`,
        type: 'system'
      }
    };
  }

  // 이동 실행
  await prisma.character.update({
    where: { id: characterId },
    data: {
      currentRoomId: exit.toRoomId
    }
  });

  // 새 룸 정보 조회
  const newRoom = await prisma.room.findUnique({
    where: { id: exit.toRoomId },
    include: {
      exits: {
        select: {
          direction: true,
          toRoomId: true
        }
      }
    }
  });

  if (!newRoom) {
    return {
      success: false,
      error: '목적지 룸을 찾을 수 없습니다.'
    };
  }

  return {
    success: true,
    log: {
      text: `${newRoom.name}에 도착했습니다.`,
      type: 'info'
    },
    stateSync: {
      character: {
        id: character.id,
        name: character.name,
        level: character.level,
        hp: character.hp,
        maxHp: character.maxHp,
        mp: character.mp,
        maxMp: character.maxMp,
        currentRoomId: newRoom.id
      },
      room: {
        id: newRoom.id,
        name: newRoom.name,
        description: newRoom.description,
        exits: newRoom.exits.map(e => ({
          direction: e.direction,
          toRoomId: e.toRoomId
        }))
      }
    }
  };
}

