// 레벨업 경험치 테이블
export const LEVEL_EXP_TABLE: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1400,
  8: 1900,
  9: 2500,
  10: 3200,
  11: 4000,
  12: 4900,
  13: 5900,
  14: 7000,
  15: 8200,
  16: 9500,
  17: 11000,
  18: 12700,
  19: 14600,
  20: 16700,
  21: 19000,
  22: 21500,
  23: 24200,
  24: 27100,
  25: 30200,
  26: 33500,
  27: 37000,
  28: 40700,
  29: 44600,
  30: 48700,
  31: 53000,
  32: 57500,
  33: 62200,
  34: 67100,
  35: 72200,
  36: 77500,
  37: 83000,
  38: 88700,
  39: 94600,
  40: 100700,
  41: 107000,
  42: 113500,
  43: 120200,
  44: 127100,
  45: 134200,
  46: 141500,
  47: 149000,
  48: 156700,
  49: 164600,
  50: 172700,
};

// 최대 레벨
export const MAX_LEVEL = 50;

// 레벨별 필요 경험치 조회
export function getRequiredExp(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return LEVEL_EXP_TABLE[level + 1] || 0;
}

// 레벨업 시 획득 스탯 포인트
export function getStatPointsPerLevel(level: number): number {
  if (level <= 10) return 3;
  if (level <= 20) return 4;
  if (level <= 30) return 5;
  if (level <= 40) return 6;
  return 7;
}

// 레벨업 시 획득 스킬 포인트
export function getSkillPointsPerLevel(level: number): number {
  if (level <= 5) return 0;
  if (level % 5 === 0) return 2; // 5, 10, 15, ... 마다 2포인트
  return 1;
}

// 레벨업 시 HP/MP 증가량
export function getStatIncreasePerLevel(level: number, statType: 'hp' | 'mp'): number {
  const baseIncrease = statType === 'hp' ? 20 : 10;
  const multiplier = Math.floor(level / 10) + 1;
  return baseIncrease * multiplier;
}

// 스탯에 따른 HP/MP 계산
export function calculateMaxHp(level: number, str: number): number {
  const baseHp = 200;
  const levelBonus = level * 20;
  const strBonus = str * 5;
  return baseHp + levelBonus + strBonus;
}

export function calculateMaxMp(level: number, intStat: number): number {
  const baseMp = 200;
  const levelBonus = level * 10;
  const intBonus = intStat * 10;
  return baseMp + levelBonus + intBonus;
}

