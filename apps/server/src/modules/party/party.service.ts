import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class PartyService {
  private partyCodeMap = new Map<string, string>(); // code -> partyId
  private characterPartyMap = new Map<string, string>(); // characterId -> partyId
  
  constructor(private readonly prisma: PrismaService) {}
  
  private generatePartyCode(): string {
    // 6자리 base32 코드 생성 (0-9, A-Z 제외 I, O, L)
    const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let code = '';
    const bytes = randomBytes(4);
    for (let i = 0; i < 6; i++) {
      code += charset[bytes[i % 4] % charset.length];
    }
    return code;
  }

  async createParty(characterId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // 이미 파티에 속해 있는지 확인
    const existingPartyId = this.characterPartyMap.get(characterId);
    if (existingPartyId) {
      throw new Error('이미 파티에 속해 있습니다.');
    }

    const code = this.generatePartyCode();
    const party = await this.prisma.party.create({
      data: {
        leaderCharacterId: characterId,
        code: code,
        roomId: character.roomId,
        members: {
          create: {
            characterId,
            role: 'LEADER',
          },
        },
      },
      include: {
        members: {
          include: {
            character: true,
          },
        },
      },
    });

    // Join code 맵 업데이트
    this.partyCodeMap.set(code, party.id);
    this.characterPartyMap.set(characterId, party.id);

    return { party, code };
  }
  
  async joinPartyByCode(characterId: string, code: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // 이미 파티에 속해 있는지 확인
    const existingPartyId = this.characterPartyMap.get(characterId);
    if (existingPartyId) {
      throw new Error('이미 파티에 속해 있습니다.');
    }

    // Code로 partyId 찾기
    const partyId = this.partyCodeMap.get(code);
    if (!partyId) {
      throw new Error('유효하지 않은 초대 코드입니다.');
    }

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });

    if (!party) {
      throw new Error('파티를 찾을 수 없습니다.');
    }

    if (party.members.length >= 4) { // MVP max=4
      throw new Error('파티가 가득 찼습니다.');
    }

    // 파티 가입
    await this.prisma.partyMember.create({
      data: {
        partyId,
        characterId,
        role: 'MEMBER',
      },
    });

    this.characterPartyMap.set(characterId, partyId);

    return this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: {
            character: true,
          },
        },
      },
    });
  }

  async inviteToParty(partyId: string, fromCharacterId: string, toCharacterName: string) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });

    if (!party) {
      throw new Error('파티를 찾을 수 없습니다.');
    }

    if (party.leaderCharacterId !== fromCharacterId) {
      throw new Error('파티 리더만 초대할 수 있습니다.');
    }

    if (party.members.length >= 6) {
      throw new Error('파티가 가득 찼습니다.');
    }

    const targetCharacter = await this.prisma.character.findUnique({
      where: { name: toCharacterName },
    });

    if (!targetCharacter) {
      throw new Error('캐릭터를 찾을 수 없습니다.');
    }

    // 초대 생성
    const invite = await this.prisma.partyInvite.create({
      data: {
        partyId,
        fromCharacterId,
        toCharacterName,
      },
    });

    return invite;
  }

  async joinParty(inviteId: string, characterId: string) {
    const invite = await this.prisma.partyInvite.findUnique({
      where: { id: inviteId },
      include: {
        party: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new Error('유효하지 않은 초대입니다.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character || character.name !== invite.toCharacterName) {
      throw new Error('초대 대상이 아닙니다.');
    }

    if (invite.party.members.length >= 6) {
      throw new Error('파티가 가득 찼습니다.');
    }

    // 파티 가입
    await this.prisma.partyMember.create({
      data: {
        partyId: invite.partyId,
        characterId,
        role: 'MEMBER',
      },
    });

    // 초대 상태 변경
    await this.prisma.partyInvite.update({
      where: { id: inviteId },
      data: { status: 'ACCEPTED' },
    });

    return this.prisma.party.findUnique({
      where: { id: invite.partyId },
      include: {
        members: {
          include: {
            character: true,
          },
        },
      },
    });
  }

  async leaveParty(characterId: string) {
    const partyId = this.characterPartyMap.get(characterId);
    if (!partyId) {
      throw new Error('파티에 속해 있지 않습니다.');
    }

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });

    if (!party) {
      throw new Error('파티를 찾을 수 없습니다.');
    }

    // 멤버 제거
    await this.prisma.partyMember.deleteMany({
      where: { partyId, characterId },
    });
    this.characterPartyMap.delete(characterId);

    // 파티가 비었으면 삭제
    const remainingMembers = party.members.filter(m => m.characterId !== characterId);
    if (remainingMembers.length === 0) {
      await this.prisma.party.delete({ where: { id: partyId } });
      // code 맵 정리
      for (const [code, pid] of this.partyCodeMap.entries()) {
        if (pid === partyId) {
          this.partyCodeMap.delete(code);
          break;
        }
      }
    } else if (party.leaderCharacterId === characterId) {
      // 리더가 나갔으면 다음 멤버를 리더로 승격
      const newLeader = remainingMembers[0];
      await this.prisma.party.update({
        where: { id: partyId },
        data: { leaderCharacterId: newLeader.characterId },
      });
      await this.prisma.partyMember.update({
        where: { id: newLeader.id },
        data: { role: 'LEADER' },
      });
    }
  }
  
  getPartyCodeByPartyId(partyId: string): string | null {
    for (const [code, pid] of this.partyCodeMap.entries()) {
      if (pid === partyId) {
        return code;
      }
    }
    return null;
  }
  
  getPartyIdByCharacterId(characterId: string): string | null {
    return this.characterPartyMap.get(characterId) || null;
  }

  async setFollow(characterId: string, follow: boolean) {
    const member = await this.prisma.partyMember.findFirst({
      where: { characterId },
    });

    if (!member) {
      throw new Error('파티에 속해 있지 않습니다.');
    }

    await this.prisma.partyMember.update({
      where: { id: member.id },
      data: { follow },
    });
  }

  async setSpeedMode(partyId: string, characterId: string, speedMode: 'FAST' | 'TACTICAL') {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
    });

    if (!party) {
      throw new Error('파티를 찾을 수 없습니다.');
    }

    if (party.leaderCharacterId !== characterId) {
      throw new Error('파티 리더만 변경할 수 있습니다.');
    }

    await this.prisma.party.update({
      where: { id: partyId },
      data: { speedMode },
    });
  }

  async setPreset(characterId: string, preset: string) {
    const member = await this.prisma.partyMember.findFirst({
      where: { characterId },
    });

    if (!member) {
      throw new Error('파티에 속해 있지 않습니다.');
    }

    await this.prisma.partyMember.update({
      where: { id: member.id },
      data: { autoPreset: preset as any },
    });
  }

  async getPartyByCharacter(characterId: string) {
    const member = await this.prisma.partyMember.findFirst({
      where: { characterId },
      include: {
        party: {
          include: {
            members: {
              include: {
                character: true,
              },
            },
          },
        },
      },
    });

    return member?.party || null;
  }
}

