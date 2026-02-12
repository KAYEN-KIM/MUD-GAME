import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { getSkill, canLearnSkill } from './skill-registry';

export interface SkillBonuses {
  str: number;
  dex: number;
  intStat: number;
  atk: number;
  def: number;
  hpMax: number;
  mpMax: number;
  critChance: number;
  dodgeChance: number;
  counterChance: number;
  damageReduction: number;
  mpCostReduction: number;
  dropRate: number;
  goldBonus: number;
  expBonus: number;
}

/**
 * NOTE:
 * 현재 Prisma 스키마에는 "CharacterSkill" 테이블(= learned skills 저장소)이 없습니다.
 * 따라서 스킬 학습/저장은 아직 영속화되지 않으며, 서버 기동을 막지 않도록 안전한 no-op로 동작합니다.
 * (향후 CharacterSkill 모델/마이그레이션 추가 시 이 서비스에서 DB 연동을 구현하면 됩니다.)
 */
export interface LearnedSkill {
  skillId: string;
  level: number;
}

@Injectable()
export class SkillService {
  constructor(private readonly prisma: PrismaService) {}

  async getCharacterSkills(_characterId: string): Promise<LearnedSkill[]> {
    // 아직 영속 저장소가 없으므로 빈 목록 반환
    return [];
  }

  async learnSkill(characterId: string, skillId: string): Promise<void> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    const skill = getSkill(skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }

    if ((character as any).skillPoints < 1) {
      throw new Error('Not enough skill points');
    }

    const learnedSkills = await this.getCharacterSkills(characterId);
    const learnedMap = new Map<string, number>(learnedSkills.map((s) => [s.skillId, s.level]));
    const currentLevel = learnedMap.get(skillId) || 0;

    if (currentLevel >= skill.maxLevel) {
      throw new Error('Skill already at max level');
    }

    if (!canLearnSkill(skill, character.level, learnedMap)) {
      throw new Error('Skill requirements not met');
    }

    // 영속 스킬 테이블이 없으므로, 현재는 스킬 포인트만 차감합니다.
    // (WS gateway에서도 SKILL_LEARN에서 동일하게 차감하므로, 중복 호출을 피하세요.)
    await this.prisma.character.update({
      where: { id: characterId },
      data: { skillPoints: { decrement: 1 } } as any,
    });
  }

  async calculateSkillBonuses(characterId: string): Promise<SkillBonuses> {
    const skills = await this.getCharacterSkills(characterId);
    const bonuses: SkillBonuses = {
      str: 0,
      dex: 0,
      intStat: 0,
      atk: 0,
      def: 0,
      hpMax: 0,
      mpMax: 0,
      critChance: 0,
      dodgeChance: 0,
      counterChance: 0,
      damageReduction: 0,
      mpCostReduction: 0,
      dropRate: 0,
      goldBonus: 0,
      expBonus: 0,
    };

    for (const learned of skills) {
      const skill = getSkill(learned.skillId);
      if (!skill || skill.type !== 'PASSIVE') continue;

      for (const effect of skill.effects) {
        const value = effect.value * learned.level;

        if (effect.type === 'FLAT' && effect.statType) {
          switch (effect.statType) {
            case 'atk':
              bonuses.atk += value;
              break;
            case 'def':
              bonuses.def += value;
              break;
            case 'hp':
              bonuses.hpMax += value;
              break;
            case 'mp':
              bonuses.mpMax += value;
              break;
          }
        } else if (effect.type === 'PERCENT') {
          // 스킬 ID로 어떤 보너스인지 판단
          switch (learned.skillId) {
            case 'critical_strike':
              bonuses.critChance += value;
              break;
            case 'dodge':
              bonuses.dodgeChance += value;
              break;
            case 'counter_attack':
              bonuses.counterChance += value;
              break;
            case 'damage_reduction':
              bonuses.damageReduction += value;
              break;
            case 'mana_efficiency':
              bonuses.mpCostReduction += value;
              break;
            case 'treasure_hunter':
              bonuses.dropRate += value;
              break;
            case 'gold_finder':
              bonuses.goldBonus += value;
              break;
            case 'exp_boost':
              bonuses.expBonus += value;
              break;
            case 'double_strike':
              // 이중 타격은 전투에서 처리
              break;
          }
        }
      }
    }

    return bonuses;
  }

  async getEnhancedCharacterStats(characterId: string): Promise<any> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    const bonuses = await this.calculateSkillBonuses(characterId);

    return {
      baseAtk: (character as any).atk || 10,
      baseDef: (character as any).def || 5,
      totalAtk: ((character as any).atk || 10) + bonuses.atk,
      totalDef: ((character as any).def || 5) + bonuses.def,
      hpMax: character.hpMax + bonuses.hpMax,
      mpMax: (character as any).mpMax + bonuses.mpMax,
      bonuses,
    };
  }
}
