import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { getDungeon, DungeonDifficulty } from './dungeon-registry';

export interface DungeonInstance {
  id: string;
  dungeonId: string;
  difficulty: DungeonDifficulty;
  partyId: string;
  roomId: string;
  state: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
}

@Injectable()
export class DungeonService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 던전 인스턴스 생성
   */
  async createDungeonInstance(
    dungeonId: string,
    difficulty: DungeonDifficulty,
    partyId: string,
    roomId: string,
  ): Promise<string> {
    const dungeon = getDungeon(dungeonId);
    if (!dungeon) {
      throw new Error('Dungeon not found');
    }

    // 파티 확인
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });

    if (!party) {
      throw new Error('Party not found');
    }

    // 파티원 레벨 확인
    for (const member of party.members) {
      const character = await this.prisma.character.findUnique({
        where: { id: member.characterId },
      });

      if (!character || character.level < dungeon.minLevel) {
        throw new Error(`파티원 레벨이 부족합니다. 최소 레벨: ${dungeon.minLevel}`);
      }
    }

    // 파티 크기 확인
    if (party.members.length > dungeon.maxPartySize) {
      throw new Error(`파티 인원이 초과되었습니다. 최대 ${dungeon.maxPartySize}명`);
    }

    // 던전 인스턴스 생성 (간소화 버전 - 추후 DungeonInstance 테이블 생성)
    // 현재는 일반 CombatInstance를 사용
    const instance = await this.prisma.combatInstance.create({
      data: {
        roomId,
        state: 'ENGAGED',
        nextTickAt: new Date(Date.now() + 2000),
        tick: 0,
      },
    });

    return instance.id;
  }

  /**
   * 던전 완료 처리
   */
  async completeDungeon(
    instanceId: string,
    partyId: string,
    dungeonId: string,
    difficulty: DungeonDifficulty,
  ): Promise<void> {
    const dungeon = getDungeon(dungeonId);
    if (!dungeon) {
      throw new Error('Dungeon not found');
    }

    const difficultyConfig = dungeon.difficulties.find((d) => d.difficulty === difficulty);
    if (!difficultyConfig) {
      throw new Error('Difficulty not found');
    }

    // 파티원에게 보상 지급
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });

    if (!party) {
      throw new Error('Party not found');
    }

    for (const member of party.members) {
      // 경험치 지급
      const expReward = Math.floor(dungeon.rewards.baseExp * difficultyConfig.rewardExpMultiplier);
      // ProgressionService를 사용해야 하지만 간소화
      await this.prisma.character.update({
        where: { id: member.characterId },
        data: {
          exp: { increment: expReward },
        },
      });

      // 골드 지급
      const goldReward = Math.floor(dungeon.rewards.baseGold * difficultyConfig.rewardGoldMultiplier);
      await this.prisma.character.update({
        where: { id: member.characterId },
        data: {
          gold: { increment: goldReward },
        },
      });

      // 보장된 아이템 지급
      if (dungeon.rewards.guaranteedItems) {
        for (const item of dungeon.rewards.guaranteedItems) {
          await this.prisma.inventory.upsert({
            where: {
              characterId_itemId: {
                characterId: member.characterId,
                itemId: item.itemId,
              },
            },
            update: {
              qty: { increment: item.qty },
            },
            create: {
              characterId: member.characterId,
              itemId: item.itemId,
              qty: item.qty,
            },
          });
        }
      }
    }
  }
}

