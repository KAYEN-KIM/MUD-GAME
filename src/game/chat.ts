import { PrismaClient } from '@prisma/client';
import { checkChatRateLimit } from '../utils/rateLimit';

const prisma = new PrismaClient();

export interface ChatResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendChatMessage(
  characterId: string,
  message: string,
  type: 'ROOM' | 'PARTY' | 'GLOBAL' = 'ROOM'
): Promise<ChatResult> {
  // 레이트 리밋 체크
  const rateLimit = await checkChatRateLimit(characterId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: '채팅 속도가 너무 빠릅니다. 잠시 후 다시 시도하세요.'
    };
  }

  // 캐릭터 정보 조회
  const character = await prisma.character.findUnique({
    where: { id: characterId }
  });

  if (!character) {
    return {
      success: false,
      error: '캐릭터를 찾을 수 없습니다.'
    };
  }

  let roomId: string | null = null;
  let partyId: string | null = null;

  if (type === 'ROOM') {
    roomId = character.currentRoomId;
  } else if (type === 'PARTY') {
    const partyMember = await prisma.partyMember.findFirst({
      where: { characterId },
      include: {
        party: true
      }
    });

    if (!partyMember) {
      return {
        success: false,
        error: '파티에 속해 있지 않습니다.'
      };
    }

    partyId = partyMember.party.id;
  }

  // 채팅 메시지 저장
  const chatMessage = await prisma.chatMessage.create({
    data: {
      characterId,
      roomId,
      partyId,
      message,
      type
    }
  });

  return {
    success: true,
    messageId: chatMessage.id
  };
}

