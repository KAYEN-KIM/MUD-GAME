import { PrismaClient } from '@prisma/client';
import { PartySpeedMode, CombatPreset } from '@prisma/client';

const prisma = new PrismaClient();

const MAX_PARTY_SIZE = 6;

export interface PartyInfo {
  id: string;
  leaderId: string;
  speedMode: PartySpeedMode;
  members: Array<{
    characterId: string;
    characterName: string;
    follow: boolean;
    preset: CombatPreset;
  }>;
}

export async function createParty(characterId: string): Promise<PartyInfo> {
  // 이미 파티에 속해있는지 확인
  const existingMember = await prisma.partyMember.findFirst({
    where: { characterId }
  });

  if (existingMember) {
    throw new Error('이미 파티에 속해 있습니다.');
  }

  // 파티 생성
  const party = await prisma.party.create({
    data: {
      leaderId: characterId,
      speedMode: 'TACTICAL',
      members: {
        create: {
          characterId,
          follow: true,
          preset: 'AGGRO'
        }
      }
    },
    include: {
      members: {
        include: {
          character: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  return {
    id: party.id,
    leaderId: party.leaderId,
    speedMode: party.speedMode,
    members: party.members.map(m => ({
      characterId: m.character.id,
      characterName: m.character.name,
      follow: m.follow,
      preset: m.preset
    }))
  };
}

export async function getPartyInfo(partyId: string): Promise<PartyInfo | null> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      members: {
        include: {
          character: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  if (!party) {
    return null;
  }

  return {
    id: party.id,
    leaderId: party.leaderId,
    speedMode: party.speedMode,
    members: party.members.map(m => ({
      characterId: m.character.id,
      characterName: m.character.name,
      follow: m.follow,
      preset: m.preset
    }))
  };
}

export async function getCharacterParty(characterId: string): Promise<PartyInfo | null> {
  const member = await prisma.partyMember.findFirst({
    where: { characterId },
    include: {
      party: {
        include: {
          members: {
            include: {
              character: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!member) {
    return null;
  }

  const party = member.party;
  return {
    id: party.id,
    leaderId: party.leaderId,
    speedMode: party.speedMode,
    members: party.members.map(m => ({
      characterId: m.character.id,
      characterName: m.character.name,
      follow: m.follow,
      preset: m.preset
    }))
  };
}

export async function inviteToParty(
  partyId: string,
  inviterId: string,
  targetCharacterName: string
): Promise<void> {
  const party = await getPartyInfo(partyId);
  if (!party) {
    throw new Error('파티를 찾을 수 없습니다.');
  }

  if (party.leaderId !== inviterId) {
    throw new Error('파티 리더만 초대할 수 있습니다.');
  }

  if (party.members.length >= MAX_PARTY_SIZE) {
    throw new Error('파티가 가득 찼습니다.');
  }

  const targetCharacter = await prisma.character.findUnique({
    where: { name: targetCharacterName }
  });

  if (!targetCharacter) {
    throw new Error('캐릭터를 찾을 수 없습니다.');
  }

  // 이미 파티에 속해있는지 확인
  const existingMember = await prisma.partyMember.findFirst({
    where: { characterId: targetCharacter.id }
  });

  if (existingMember) {
    throw new Error('이미 파티에 속해 있습니다.');
  }

  // 초대 생성 (30분 유효)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);

  await prisma.partyInvite.create({
    data: {
      partyId,
      characterId: targetCharacter.id,
      inviterId,
      expiresAt
    }
  });
}

export async function joinParty(partyId: string, characterId: string): Promise<PartyInfo> {
  // 초대 확인
  const invite = await prisma.partyInvite.findFirst({
    where: {
      partyId,
      characterId,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!invite) {
    throw new Error('유효한 초대가 없습니다.');
  }

  const party = await getPartyInfo(partyId);
  if (!party) {
    throw new Error('파티를 찾을 수 없습니다.');
  }

  if (party.members.length >= MAX_PARTY_SIZE) {
    throw new Error('파티가 가득 찼습니다.');
  }

  // 파티 가입
  await prisma.partyMember.create({
    data: {
      partyId,
      characterId,
      follow: true,
      preset: 'AGGRO'
    }
  });

  // 초대 삭제
  await prisma.partyInvite.delete({
    where: { id: invite.id }
  });

  return await getPartyInfo(partyId)!;
}

export async function leaveParty(characterId: string): Promise<void> {
  const member = await prisma.partyMember.findFirst({
    where: { characterId },
    include: {
      party: true
    }
  });

  if (!member) {
    throw new Error('파티에 속해 있지 않습니다.');
  }

  const party = member.party;

  // 리더인 경우 파티 해산
  if (party.leaderId === characterId) {
    await prisma.party.delete({
      where: { id: party.id }
    });
  } else {
    // 일반 멤버인 경우 탈퇴
    await prisma.partyMember.delete({
      where: { id: member.id }
    });
  }
}

export async function setPartyLeader(partyId: string, newLeaderId: string, requesterId: string): Promise<PartyInfo> {
  const party = await getPartyInfo(partyId);
  if (!party) {
    throw new Error('파티를 찾을 수 없습니다.');
  }

  if (party.leaderId !== requesterId) {
    throw new Error('파티 리더만 리더를 변경할 수 있습니다.');
  }

  // 새 리더가 파티 멤버인지 확인
  const isMember = party.members.some(m => m.characterId === newLeaderId);
  if (!isMember) {
    throw new Error('파티 멤버가 아닙니다.');
  }

  await prisma.party.update({
    where: { id: partyId },
    data: {
      leaderId: newLeaderId
    }
  });

  return await getPartyInfo(partyId)!;
}

export async function setFollow(characterId: string, follow: boolean): Promise<void> {
  const member = await prisma.partyMember.findFirst({
    where: { characterId }
  });

  if (!member) {
    throw new Error('파티에 속해 있지 않습니다.');
  }

  await prisma.partyMember.update({
    where: { id: member.id },
    data: { follow }
  });
}

export async function setSpeedMode(partyId: string, speedMode: PartySpeedMode, requesterId: string): Promise<void> {
  const party = await getPartyInfo(partyId);
  if (!party) {
    throw new Error('파티를 찾을 수 없습니다.');
  }

  if (party.leaderId !== requesterId) {
    throw new Error('파티 리더만 속도를 변경할 수 있습니다.');
  }

  await prisma.party.update({
    where: { id: partyId },
    data: { speedMode }
  });
}

export async function setPreset(characterId: string, preset: CombatPreset): Promise<void> {
  const member = await prisma.partyMember.findFirst({
    where: { characterId }
  });

  if (!member) {
    throw new Error('파티에 속해 있지 않습니다.');
  }

  await prisma.partyMember.update({
    where: { id: member.id },
    data: { preset }
  });
}

