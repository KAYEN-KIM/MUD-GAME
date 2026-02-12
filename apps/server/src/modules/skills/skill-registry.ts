// 스킬 레지스트리

export enum SkillType {
  PASSIVE = 'PASSIVE', // 항상 적용
  ACTIVE = 'ACTIVE', // 수동 사용
  TOGGLE = 'TOGGLE', // 켜고 끄기
}

export enum SkillCategory {
  COMBAT = 'COMBAT',
  DEFENSE = 'DEFENSE',
  SUPPORT = 'SUPPORT',
  UTILITY = 'UTILITY',
}

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  category: SkillCategory;
  maxLevel: number;
  description: string;
  requiredLevel: number; // 캐릭터 레벨 요구사항
  requiredSkills?: { skillId: string; level: number }[]; // 선행 스킬
  effects: SkillEffect[];
}

export interface SkillEffect {
  statType?: 'str' | 'dex' | 'intStat' | 'hp' | 'mp' | 'atk' | 'def' | 'spd';
  value: number; // 스킬 레벨당 증가량
  baseValue?: number; // 기본값
  multiplier?: number; // 배율
  type: 'FLAT' | 'PERCENT' | 'SPECIAL';
}

const SKILLS: Record<string, Skill> = {
  // ============================================================
  // 전투 스킬 (COMBAT)
  // ============================================================
  power_attack: {
    id: 'power_attack',
    name: '강타',
    type: SkillType.ACTIVE,
    category: SkillCategory.COMBAT,
    maxLevel: 10,
    description: '강력한 공격을 가하여 추가 피해를 입힙니다.',
    requiredLevel: 5,
    effects: [
      { statType: 'atk', value: 3, type: 'FLAT' }, // 레벨당 공격력 +3
    ],
  },
  critical_strike: {
    id: 'critical_strike',
    name: '치명타',
    type: SkillType.PASSIVE,
    category: SkillCategory.COMBAT,
    maxLevel: 5,
    description: '일정 확률로 치명타를 발동하여 2배 피해를 입힙니다.',
    requiredLevel: 10,
    effects: [
      { value: 2, type: 'PERCENT' }, // 레벨당 치명타 확률 +2%
    ],
  },
  double_strike: {
    id: 'double_strike',
    name: '이중 타격',
    type: SkillType.PASSIVE,
    category: SkillCategory.COMBAT,
    maxLevel: 5,
    description: '일정 확률로 2회 공격합니다.',
    requiredLevel: 15,
    requiredSkills: [{ skillId: 'power_attack', level: 5 }],
    effects: [
      { value: 3, type: 'PERCENT' }, // 레벨당 발동 확률 +3%
    ],
  },
  execution: {
    id: 'execution',
    name: '처형',
    type: SkillType.ACTIVE,
    category: SkillCategory.COMBAT,
    maxLevel: 5,
    description: 'HP가 30% 이하인 적에게 추가 피해를 입힙니다.',
    requiredLevel: 20,
    effects: [
      { value: 10, type: 'PERCENT' }, // 레벨당 추가 피해 +10%
    ],
  },
  
  // ============================================================
  // 방어 스킬 (DEFENSE)
  // ============================================================
  tough_skin: {
    id: 'tough_skin',
    name: '강인한 피부',
    type: SkillType.PASSIVE,
    category: SkillCategory.DEFENSE,
    maxLevel: 10,
    description: '방어력이 영구적으로 증가합니다.',
    requiredLevel: 3,
    effects: [
      { statType: 'def', value: 2, type: 'FLAT' }, // 레벨당 방어력 +2
    ],
  },
  dodge: {
    id: 'dodge',
    name: '회피',
    type: SkillType.PASSIVE,
    category: SkillCategory.DEFENSE,
    maxLevel: 5,
    description: '일정 확률로 공격을 회피합니다.',
    requiredLevel: 8,
    effects: [
      { value: 2, type: 'PERCENT' }, // 레벨당 회피 확률 +2%
    ],
  },
  counter_attack: {
    id: 'counter_attack',
    name: '반격',
    type: SkillType.PASSIVE,
    category: SkillCategory.DEFENSE,
    maxLevel: 5,
    description: '피격 시 일정 확률로 자동 반격합니다.',
    requiredLevel: 12,
    requiredSkills: [{ skillId: 'dodge', level: 3 }],
    effects: [
      { value: 4, type: 'PERCENT' }, // 레벨당 반격 확률 +4%
    ],
  },
  damage_reduction: {
    id: 'damage_reduction',
    name: '피해 감소',
    type: SkillType.PASSIVE,
    category: SkillCategory.DEFENSE,
    maxLevel: 10,
    description: '받는 모든 피해가 감소합니다.',
    requiredLevel: 15,
    effects: [
      { value: 1, type: 'PERCENT' }, // 레벨당 피해 감소 +1%
    ],
  },
  
  // ============================================================
  // 지원 스킬 (SUPPORT)
  // ============================================================
  mana_efficiency: {
    id: 'mana_efficiency',
    name: '마나 효율',
    type: SkillType.PASSIVE,
    category: SkillCategory.SUPPORT,
    maxLevel: 10,
    description: '주문 시전 시 MP 소모량이 감소합니다.',
    requiredLevel: 5,
    effects: [
      { value: 2, type: 'PERCENT' }, // 레벨당 MP 소모 감소 -2%
    ],
  },
  meditation: {
    id: 'meditation',
    name: '명상',
    type: SkillType.PASSIVE,
    category: SkillCategory.SUPPORT,
    maxLevel: 10,
    description: '최대 MP가 증가합니다.',
    requiredLevel: 3,
    effects: [
      { statType: 'mp', value: 10, type: 'FLAT' }, // 레벨당 최대 MP +10
    ],
  },
  mp_regeneration: {
    id: 'mp_regeneration',
    name: 'MP 재생',
    type: SkillType.PASSIVE,
    category: SkillCategory.SUPPORT,
    maxLevel: 5,
    description: '전투 중 일정 시간마다 MP가 자동으로 회복됩니다.',
    requiredLevel: 10,
    requiredSkills: [{ skillId: 'meditation', level: 5 }],
    effects: [
      { value: 1, type: 'FLAT' }, // 레벨당 틱당 회복량 +1
    ],
  },
  
  // ============================================================
  // 유틸리티 스킬 (UTILITY)
  // ============================================================
  treasure_hunter: {
    id: 'treasure_hunter',
    name: '보물 사냥꾼',
    type: SkillType.PASSIVE,
    category: SkillCategory.UTILITY,
    maxLevel: 5,
    description: '아이템 드롭 확률이 증가합니다.',
    requiredLevel: 7,
    effects: [
      { value: 5, type: 'PERCENT' }, // 레벨당 드롭률 +5%
    ],
  },
  gold_finder: {
    id: 'gold_finder',
    name: '황금 채굴자',
    type: SkillType.PASSIVE,
    category: SkillCategory.UTILITY,
    maxLevel: 5,
    description: '몬스터에게서 획득하는 골드가 증가합니다.',
    requiredLevel: 5,
    effects: [
      { value: 5, type: 'PERCENT' }, // 레벨당 골드 획득량 +5%
    ],
  },
  exp_boost: {
    id: 'exp_boost',
    name: '경험치 증폭',
    type: SkillType.PASSIVE,
    category: SkillCategory.UTILITY,
    maxLevel: 5,
    description: '획득하는 경험치가 증가합니다.',
    requiredLevel: 10,
    effects: [
      { value: 4, type: 'PERCENT' }, // 레벨당 경험치 +4%
    ],
  },
};

export function getSkill(skillId: string): Skill | null {
  return SKILLS[skillId] || null;
}

export function getAllSkills(): Skill[] {
  return Object.values(SKILLS);
}

export function getSkillsByCategory(category: SkillCategory): Skill[] {
  return Object.values(SKILLS).filter((s) => s.category === category);
}

// 스킬 요구사항 충족 확인
export function canLearnSkill(
  skill: Skill,
  characterLevel: number,
  learnedSkills: Map<string, number>,
): boolean {
  // 레벨 요구사항
  if (characterLevel < skill.requiredLevel) {
    return false;
  }

  // 선행 스킬 요구사항
  if (skill.requiredSkills) {
    for (const req of skill.requiredSkills) {
      const currentLevel = learnedSkills.get(req.skillId) || 0;
      if (currentLevel < req.level) {
        return false;
      }
    }
  }

  return true;
}

