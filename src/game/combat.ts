import { PrismaClient } from '@prisma/client';
import { getEncounter } from './encounter';
import { getPartyInfo } from './party';
import { CombatPreset } from '@prisma/client';

const prisma = new PrismaClient();

export interface CombatAction {
  participantId: string;
  action: string;
  targetId?: string;
}

export async function processCombatTurn(encounterId: string): Promise<void> {
  const encounter = await getEncounter(encounterId);
  if (!encounter || encounter.status !== 'ACTIVE') {
    return;
  }

  const participants = encounter.participants;
  const players = participants.filter(p => p.isPlayer);
  const monsters = participants.filter(p => !p.isPlayer);

  if (players.length === 0 || monsters.length === 0) {
    // 전투 종료
    await prisma.encounter.update({
      where: { id: encounterId },
      data: { status: 'RESOLVED' }
    });
    return;
  }

  // 모든 플레이어의 행동 결정 (입력이 없으면 프리셋 사용)
  const actions: CombatAction[] = [];

  for (const player of players) {
    let action = player.action || 'ATTACK';
    let targetId = player.actionTarget;

    // 입력이 없으면 프리셋 사용
    if (!player.action && player.characterId) {
      const partyMember = await prisma.partyMember.findFirst({
        where: { characterId: player.characterId }
      });

      if (partyMember) {
        const preset = partyMember.preset;
        action = getPresetAction(preset);
      }
    }

    // 타겟이 없으면 랜덤 몬스터 선택
    if (!targetId && monsters.length > 0) {
      targetId = monsters[Math.floor(Math.random() * monsters.length)].id;
    }

    actions.push({
      participantId: player.id,
      action,
      targetId
    });
  }

  // 몬스터 행동 결정 (AI)
  for (const monster of monsters) {
    const target = players[Math.floor(Math.random() * players.length)];
    actions.push({
      participantId: monster.id,
      action: 'ATTACK',
      targetId: target.id
    });
  }

  // 행동 실행
  for (const action of actions) {
    await executeAction(encounterId, action, participants);
  }

  // 턴 번호 증가 및 다음 턴 시간 설정
  const turnDuration = encounter.speedMode === 'FAST' ? 6000 : 9000;
  const turnEndsAt = new Date(Date.now() + turnDuration);

  await prisma.encounter.update({
    where: { id: encounterId },
    data: {
      turnNumber: encounter.turnNumber + 1,
      turnEndsAt
    }
  });

  // 참가자 행동 초기화
  await prisma.encounterParticipant.updateMany({
    where: { encounterId },
    data: {
      action: null,
      actionTarget: null
    }
  });
}

function getPresetAction(preset: CombatPreset): string {
  switch (preset) {
    case 'AGGRO':
    case 'SAVER':
      return 'ATTACK';
    case 'GUARD':
    case 'SUSTAIN':
    case 'SUPPORT':
      return 'GUARD';
    case 'RETREAT':
      return 'RETREAT';
    default:
      return 'ATTACK';
  }
}

async function executeAction(
  encounterId: string,
  action: CombatAction,
  participants: any[]
): Promise<void> {
  const actor = participants.find(p => p.id === action.participantId);
  if (!actor) return;

  const target = action.targetId ? participants.find(p => p.id === action.targetId) : null;

  if (action.action === 'ATTACK' && target) {
    // 공격 계산
    const damage = calculateDamage(actor, target);
    const newHp = Math.max(0, target.hp - damage);

    await prisma.encounterParticipant.update({
      where: { id: target.id },
      data: { hp: newHp }
    });

    // 턴 로그 저장
    await prisma.encounterTurn.create({
      data: {
        encounterId,
        turnNumber: (await prisma.encounter.findUnique({ where: { id: encounterId } }))!.turnNumber,
        actorId: actor.id,
        action: 'ATTACK',
        targetId: target.id,
        damage,
        result: {
          actorName: actor.character?.name || actor.monster?.name,
          targetName: target.character?.name || target.monster?.name,
          damage
        }
      }
    });

    // HP가 0이면 제거
    if (newHp === 0) {
      await prisma.encounterParticipant.delete({
        where: { id: target.id }
      });
    }
  } else if (action.action === 'GUARD') {
    // 방어 (다음 턴 데미지 감소)
    await prisma.encounterTurn.create({
      data: {
        encounterId,
        turnNumber: (await prisma.encounter.findUnique({ where: { id: encounterId } }))!.turnNumber,
        actorId: actor.id,
        action: 'GUARD',
        result: {
          actorName: actor.character?.name || actor.monster?.name
        }
      }
    });
  } else if (action.action === 'RETREAT') {
    // 도주 시도 (MVP에서는 항상 성공)
    await prisma.encounter.update({
      where: { id: encounterId },
      data: { status: 'ESCAPED' }
    });
  }
}

function calculateDamage(attacker: any, defender: any): number {
  const baseDamage = attacker.str || 10;
  const defense = defender.vit || 5;
  const damage = Math.max(1, baseDamage - Math.floor(defense / 2));
  
  // 랜덤 변동 (80% ~ 120%)
  const variance = 0.8 + Math.random() * 0.4;
  return Math.floor(damage * variance);
}

export async function setCombatAction(
  encounterId: string,
  characterId: string,
  action: string,
  targetId?: string
): Promise<void> {
  const participant = await prisma.encounterParticipant.findFirst({
    where: {
      encounterId,
      characterId
    }
  });

  if (!participant) {
    throw new Error('전투에 참가하지 않았습니다.');
  }

  await prisma.encounterParticipant.update({
    where: { id: participant.id },
    data: {
      action,
      actionTarget: targetId || null
    }
  });
}

export async function useTimeBank(encounterId: string, partyId: string, requesterId: string): Promise<void> {
  const encounter = await getEncounter(encounterId);
  if (!encounter) {
    throw new Error('전투를 찾을 수 없습니다.');
  }

  const party = await getPartyInfo(partyId);
  if (!party || party.leaderId !== requesterId) {
    throw new Error('파티 리더만 타임뱅크를 사용할 수 있습니다.');
  }

  if (encounter.timeBankUsed) {
    throw new Error('이미 타임뱅크를 사용했습니다.');
  }

  // 턴 시간 6초 연장
  const newTurnEndsAt = new Date(encounter.turnEndsAt.getTime() + 6000);

  await prisma.encounter.update({
    where: { id: encounterId },
    data: {
      turnEndsAt: newTurnEndsAt,
      timeBankUsed: true
    }
  });
}

