import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  getRequiredExp,
  getStatPointsPerLevel,
  getSkillPointsPerLevel,
  calculateMaxHp,
  calculateMaxMp,
  MAX_LEVEL,
} from '../../utils/level-table';

export interface LevelUpResult {
  newLevel: number;
  statPointsGained: number;
  skillPointsGained: number;
  hpMaxIncrease: number;
  mpMaxIncrease: number;
  newHpMax: number;
  newMpMax: number;
}

@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 경험치 추가 및 레벨업 처리
   */
  async addExp(characterId: string, expGained: number): Promise<{ leveledUp: boolean; results: LevelUpResult[] }> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    if (character.level >= MAX_LEVEL) {
      return { leveledUp: false, results: [] };
    }

    let currentExp = character.exp + expGained;
    let currentLevel = character.level;
    const levelUpResults: LevelUpResult[] = [];

    // 연속 레벨업 처리
    while (currentLevel < MAX_LEVEL) {
      const requiredExp = getRequiredExp(currentLevel);
      if (currentExp < requiredExp) break;

      currentExp -= requiredExp;
      currentLevel++;

      // 레벨업 보상 계산
      const statPointsGained = getStatPointsPerLevel(currentLevel);
      const skillPointsGained = getSkillPointsPerLevel(currentLevel);
      
      const newHpMax = calculateMaxHp(currentLevel, character.str);
      const newMpMax = calculateMaxMp(currentLevel, character.intStat);
      const hpMaxIncrease = newHpMax - character.hpMax;
      const mpMaxIncrease = newMpMax - character.mpMax;

      levelUpResults.push({
        newLevel: currentLevel,
        statPointsGained,
        skillPointsGained,
        hpMaxIncrease,
        mpMaxIncrease,
        newHpMax,
        newMpMax,
      });
    }

    // 레벨업이 발생한 경우 DB 업데이트
    if (levelUpResults.length > 0) {
      const lastResult = levelUpResults[levelUpResults.length - 1];
      const totalStatPoints = levelUpResults.reduce((sum, r) => sum + r.statPointsGained, 0);
      const totalSkillPoints = levelUpResults.reduce((sum, r) => sum + r.skillPointsGained, 0);

      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          level: currentLevel,
          exp: currentExp,
          hpMax: lastResult.newHpMax,
          mpMax: lastResult.newMpMax,
          hp: lastResult.newHpMax, // 레벨업 시 HP 완전 회복
          mp: lastResult.newMpMax, // 레벨업 시 MP 완전 회복
          statPoints: { increment: totalStatPoints },
          skillPoints: { increment: totalSkillPoints },
        } as any,
      });

      return { leveledUp: true, results: levelUpResults };
    }

    // 레벨업 없이 경험치만 증가
    await this.prisma.character.update({
      where: { id: characterId },
      data: { exp: currentExp },
    });

    return { leveledUp: false, results: [] };
  }

  /**
   * 스탯 포인트 분배
   */
  async allocateStat(
    characterId: string,
    statType: 'str' | 'dex' | 'intStat',
    points: number,
  ): Promise<void> {
    if (points <= 0) {
      throw new Error('Points must be positive');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    if ((character as any).statPoints < points) {
      throw new Error('Not enough stat points');
    }

    const updateData: any = {
      statPoints: { decrement: points },
    };

    updateData[statType] = { increment: points };

    // HP/MP 재계산
    if (statType === 'str') {
      const newHpMax = calculateMaxHp(character.level, character.str + points);
      updateData.hpMax = newHpMax;
      updateData.hp = Math.min(character.hp + (newHpMax - character.hpMax), newHpMax);
    } else if (statType === 'intStat') {
      const newMpMax = calculateMaxMp(character.level, character.intStat + points);
      updateData.mpMax = newMpMax;
      updateData.mp = Math.min(character.mp + (newMpMax - (character as any).mpMax), newMpMax);
    }

    await this.prisma.character.update({
      where: { id: characterId },
      data: updateData as any,
    });
  }

  /**
   * 스탯 포인트 초기화 (재분배)
   */
  async resetStats(characterId: string, cost: number = 1000): Promise<void> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    if (character.gold < cost) {
      throw new Error('Not enough gold');
    }

    // 기본 스탯으로 리셋 (레벨 1 기준)
    const baseStr = 20;
    const baseDex = 20;
    const baseInt = 20;

    // 사용한 스탯 포인트 계산
    const usedStatPoints = 
      (character.str - baseStr) + 
      (character.dex - baseDex) + 
      (character.intStat - baseInt);

    // 스탯 리셋
    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        str: baseStr,
        dex: baseDex,
        intStat: baseInt,
        statPoints: (character as any).statPoints + usedStatPoints,
        gold: character.gold - cost,
        hpMax: calculateMaxHp(character.level, baseStr),
        mpMax: calculateMaxMp(character.level, baseInt),
      } as any,
    });
  }
}

