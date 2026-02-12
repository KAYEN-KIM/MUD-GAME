// Spell registry for CAST system

export interface Spell {
  id: string;
  name: string;
  type: 'DAMAGE' | 'HEAL' | 'BUFF' | 'DEBUFF' | 'SHIELD';
  castTimeMs: number;
  roundtimeMs: number;
  power: number; // Base damage/healing power or effect strength
  mpCost: number; // MP cost to cast
  cooldownMs: number; // Cooldown in milliseconds (0 = no cooldown)
  durationMs?: number; // Duration for buffs/debuffs/shields (in milliseconds)
  description: string;
  targetType: 'SELF' | 'ENEMY' | 'ALLY' | 'ANY'; // Who can be targeted
}

const SPELLS: Record<string, Spell> = {
  // 기존 주문
  missile: {
    id: 'missile',
    name: 'Magic Missile',
    type: 'DAMAGE',
    castTimeMs: 4000,
    roundtimeMs: 2000,
    power: 15,
    mpCost: 10,
    cooldownMs: 0,
    description: '마법 에너지의 화살을 발사하여 적에게 피해를 입힙니다.',
    targetType: 'ENEMY',
  },
  heal: {
    id: 'heal',
    name: 'Healing Light',
    type: 'HEAL',
    castTimeMs: 4000,
    roundtimeMs: 2000,
    power: 25,
    mpCost: 15,
    cooldownMs: 0,
    description: '빛의 힘으로 자신의 체력을 회복합니다.',
    targetType: 'SELF',
  },
  
  // 새로운 주문
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    type: 'DAMAGE',
    castTimeMs: 5000,
    roundtimeMs: 3000,
    power: 30,
    mpCost: 25,
    cooldownMs: 0,
    description: '강력한 화염구를 발사하여 적에게 큰 피해를 입힙니다.',
    targetType: 'ENEMY',
  },
  shield: {
    id: 'shield',
    name: 'Magic Shield',
    type: 'SHIELD',
    castTimeMs: 3000,
    roundtimeMs: 2000,
    power: 50, // Shield absorption amount
    mpCost: 20,
    cooldownMs: 10000, // 10초 쿨다운
    durationMs: 30000, // 30초 지속
    description: '마법 보호막을 생성하여 받는 피해를 감소시킵니다.',
    targetType: 'SELF',
  },
  strength: {
    id: 'strength',
    name: 'Strength Boost',
    type: 'BUFF',
    castTimeMs: 3000,
    roundtimeMs: 2000,
    power: 5, // Attack power boost
    mpCost: 15,
    cooldownMs: 0,
    durationMs: 60000, // 60초 지속
    description: '일정 시간 동안 공격력을 증가시킵니다.',
    targetType: 'SELF',
  },
  weakness: {
    id: 'weakness',
    name: 'Weakness',
    type: 'DEBUFF',
    castTimeMs: 4000,
    roundtimeMs: 2000,
    power: 3, // Defense reduction
    mpCost: 20,
    cooldownMs: 0,
    durationMs: 45000, // 45초 지속
    description: '적의 방어력을 일정 시간 동안 감소시킵니다.',
    targetType: 'ENEMY',
  },
  
  // 추가 데미지 주문
  icebolt: {
    id: 'icebolt',
    name: 'Ice Bolt',
    type: 'DAMAGE',
    castTimeMs: 4000,
    roundtimeMs: 2000,
    power: 18,
    mpCost: 12,
    cooldownMs: 0,
    description: '얼음의 화살을 발사하여 적을 공격합니다.',
    targetType: 'ENEMY',
  },
  lightning: {
    id: 'lightning',
    name: 'Lightning Strike',
    type: 'DAMAGE',
    castTimeMs: 3000,
    roundtimeMs: 2000,
    power: 25,
    mpCost: 20,
    cooldownMs: 0,
    description: '번개를 소환하여 적에게 강력한 피해를 입힙니다.',
    targetType: 'ENEMY',
  },
  earthspike: {
    id: 'earthspike',
    name: 'Earth Spike',
    type: 'DAMAGE',
    castTimeMs: 4500,
    roundtimeMs: 2500,
    power: 22,
    mpCost: 18,
    cooldownMs: 0,
    description: '땅에서 바위 가시를 솟아오르게 하여 적을 공격합니다.',
    targetType: 'ENEMY',
  },
  windslash: {
    id: 'windslash',
    name: 'Wind Slash',
    type: 'DAMAGE',
    castTimeMs: 2500,
    roundtimeMs: 1500,
    power: 12,
    mpCost: 8,
    cooldownMs: 0,
    description: '바람의 칼날을 날려 빠르게 적을 공격합니다.',
    targetType: 'ENEMY',
  },
  inferno: {
    id: 'inferno',
    name: 'Inferno',
    type: 'DAMAGE',
    castTimeMs: 6000,
    roundtimeMs: 4000,
    power: 50,
    mpCost: 40,
    cooldownMs: 15000, // 15초 쿨다운
    description: '거대한 화염의 폭풍을 일으켜 적에게 막대한 피해를 입힙니다.',
    targetType: 'ENEMY',
  },
  
  // 추가 회복 주문
  regeneration: {
    id: 'regeneration',
    name: 'Regeneration',
    type: 'HEAL',
    castTimeMs: 3000,
    roundtimeMs: 2000,
    power: 15,
    mpCost: 10,
    cooldownMs: 0,
    description: '빠르게 소량의 체력을 회복합니다.',
    targetType: 'SELF',
  },
  greatheal: {
    id: 'greatheal',
    name: 'Greater Healing',
    type: 'HEAL',
    castTimeMs: 5000,
    roundtimeMs: 3000,
    power: 80,
    mpCost: 35,
    cooldownMs: 10000, // 10초 쿨다운
    description: '강력한 치유력으로 체력을 대량 회복합니다.',
    targetType: 'SELF',
  },
  
  // 추가 버프 주문
  haste: {
    id: 'haste',
    name: 'Haste',
    type: 'BUFF',
    castTimeMs: 3000,
    roundtimeMs: 2000,
    power: 3, // Speed boost
    mpCost: 20,
    cooldownMs: 0,
    durationMs: 60000,
    description: '이동 속도와 공격 속도를 증가시킵니다.',
    targetType: 'SELF',
  },
  berserk: {
    id: 'berserk',
    name: 'Berserk',
    type: 'BUFF',
    castTimeMs: 2000,
    roundtimeMs: 1500,
    power: 10, // Attack boost
    mpCost: 25,
    cooldownMs: 20000, // 20초 쿨다운
    durationMs: 30000, // 30초 지속
    description: '광폭화하여 공격력을 대폭 증가시킵니다.',
    targetType: 'SELF',
  },
  ironSkin: {
    id: 'ironskin',
    name: 'Iron Skin',
    type: 'BUFF',
    castTimeMs: 3000,
    roundtimeMs: 2000,
    power: 5, // Defense boost
    mpCost: 18,
    cooldownMs: 0,
    durationMs: 60000,
    description: '피부를 강철처럼 단단하게 하여 방어력을 증가시킵니다.',
    targetType: 'SELF',
  },
  
  // 추가 디버프 주문
  curse: {
    id: 'curse',
    name: 'Curse',
    type: 'DEBUFF',
    castTimeMs: 4000,
    roundtimeMs: 2000,
    power: 5, // Attack reduction
    mpCost: 18,
    cooldownMs: 0,
    durationMs: 45000,
    description: '저주를 걸어 적의 공격력을 감소시킵니다.',
    targetType: 'ENEMY',
  },
  slow: {
    id: 'slow',
    name: 'Slow',
    type: 'DEBUFF',
    castTimeMs: 3000,
    roundtimeMs: 2000,
    power: 2, // Speed reduction
    mpCost: 15,
    cooldownMs: 0,
    durationMs: 60000,
    description: '적의 이동 속도와 공격 속도를 감소시킵니다.',
    targetType: 'ENEMY',
  },
  
  // 추가 실드 주문
  barrier: {
    id: 'barrier',
    name: 'Barrier',
    type: 'SHIELD',
    castTimeMs: 2500,
    roundtimeMs: 1500,
    power: 30,
    mpCost: 15,
    cooldownMs: 8000, // 8초 쿨다운
    durationMs: 20000, // 20초 지속
    description: '작은 보호막을 생성하여 피해를 흡수합니다.',
    targetType: 'SELF',
  },
  holyward: {
    id: 'holyward',
    name: 'Holy Ward',
    type: 'SHIELD',
    castTimeMs: 5000,
    roundtimeMs: 3000,
    power: 100,
    mpCost: 50,
    cooldownMs: 30000, // 30초 쿨다운
    durationMs: 60000, // 60초 지속
    description: '신성한 결계를 생성하여 대량의 피해를 흡수합니다.',
    targetType: 'SELF',
  },
};

export function getSpell(spellId: string): Spell | null {
  return SPELLS[spellId.toLowerCase()] || null;
}

export function getAllSpells(): Spell[] {
  return Object.values(SPELLS);
}

// 스펠 시너지 효과 (여러 스펠 조합 시 보너스)
export interface SpellSynergy {
  spells: string[]; // 조합에 필요한 스펠 ID들
  effect: {
    type: 'DAMAGE_BOOST' | 'HEAL_BOOST' | 'MP_REDUCTION' | 'COOLDOWN_REDUCTION';
    value: number; // 보너스 값 (% 또는 절대값)
  };
}

const SPELL_SYNERGIES: SpellSynergy[] = [
  {
    spells: ['fireball', 'icebolt'],
    effect: { type: 'DAMAGE_BOOST', value: 15 }, // 화염+얼음 조합 시 데미지 +15%
  },
  {
    spells: ['heal', 'regeneration'],
    effect: { type: 'HEAL_BOOST', value: 20 }, // 힐+재생 조합 시 회복량 +20%
  },
  {
    spells: ['missile', 'lightning'],
    effect: { type: 'MP_REDUCTION', value: 10 }, // 미사일+번개 조합 시 MP 소모 -10%
  },
  {
    spells: ['shield', 'barrier'],
    effect: { type: 'COOLDOWN_REDUCTION', value: 30 }, // 실드+배리어 조합 시 쿨다운 -30%
  },
];

export function getSpellSynergy(castSpells: string[]): SpellSynergy | null {
  for (const synergy of SPELL_SYNERGIES) {
    if (synergy.spells.every((spellId) => castSpells.includes(spellId))) {
      return synergy;
    }
  }
  return null;
}

export function applySpellSynergy(
  spell: Spell,
  synergy: SpellSynergy | null,
): { power: number; mpCost: number; cooldownMs: number } {
  let power = spell.power;
  let mpCost = spell.mpCost;
  let cooldownMs = spell.cooldownMs;

  if (!synergy) return { power, mpCost, cooldownMs };

  switch (synergy.effect.type) {
    case 'DAMAGE_BOOST':
      if (spell.type === 'DAMAGE') {
        power = Math.floor(power * (1 + synergy.effect.value / 100));
      }
      break;
    case 'HEAL_BOOST':
      if (spell.type === 'HEAL') {
        power = Math.floor(power * (1 + synergy.effect.value / 100));
      }
      break;
    case 'MP_REDUCTION':
      mpCost = Math.max(1, Math.floor(mpCost * (1 - synergy.effect.value / 100)));
      break;
    case 'COOLDOWN_REDUCTION':
      cooldownMs = Math.max(0, Math.floor(cooldownMs * (1 - synergy.effect.value / 100)));
      break;
  }

  return { power, mpCost, cooldownMs };
}

