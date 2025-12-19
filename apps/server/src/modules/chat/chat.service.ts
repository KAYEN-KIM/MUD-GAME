import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RateLimitService } from '../../rate-limit/rate-limit.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async sendChat(
    characterId: string,
    channel: 'GLOBAL' | 'LOCAL' | 'PARTY' | 'WHISPER',
    text: string,
    toName?: string,
  ) {
    // 레이트 리밋 확인
    const rateCheck = await this.rateLimit.checkChatRateLimit(characterId);
    if (!rateCheck.allowed) {
      throw new Error('채팅 속도가 너무 빠릅니다.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // MUTE 확인
    const punishment = await this.prisma.punishment.findFirst({
      where: {
        targetName: character.name,
        type: 'MUTE',
        OR: [{ untilAt: null }, { untilAt: { gt: new Date() } }],
      },
    });

    if (punishment) {
      throw new Error(`채팅이 금지되었습니다. 사유: ${punishment.note}`);
    }

    // 채팅 메시지 저장
    let roomId: string | null = null;
    let partyId: string | null = null;

    if (channel === 'LOCAL') {
      roomId = character.roomId;
    } else if (channel === 'PARTY') {
      const partyMember = await this.prisma.partyMember.findFirst({
        where: { characterId },
      });
      partyId = partyMember?.partyId || null;
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        channel,
        roomId,
        partyId,
        fromCharacterId: characterId,
        toName,
        text,
      },
    });

    return message;
  }
}

