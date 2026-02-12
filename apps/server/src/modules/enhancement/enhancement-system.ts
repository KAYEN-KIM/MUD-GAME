// 장비 강화 시스템

export interface EnhancementResult {
  success: boolean;
  newLevel: number;
  itemDestroyed: boolean;
  message: string;
}

// 강화 확률 (레벨별)
const ENHANCEMENT_RATES = new Map<number, number>([
  [0, 95], // +0 -> +1: 95%
  [1, 90], // +1 -> +2: 90%
  [2, 80], // +2 -> +3: 80%
  [3, 70], // +3 -> +4: 70%
  [4, 60], // +4 -> +5: 60%
  [5, 50], // +5 -> +6: 50%
  [6, 40], // +6 -> +7: 40%
  [7, 30], // +7 -> +8: 30%
  [8, 20], // +8 -> +9: 20%
  [9, 10], // +9 -> +10: 10%
]);

// 실패 시 파괴 확률
const DESTRUCTION_RATES = new Map<number, number>([
  [0, 0],  // +0 -> +1: 0% (파괴 안됨)
  [1, 0],  // +1 -> +2: 0%
  [2, 0],  // +2 -> +3: 0%
  [3, 0],  // +3 -> +4: 0%
  [4, 5],  // +4 -> +5: 5%
  [5, 10], // +5 -> +6: 10%
  [6, 20], // +6 -> +7: 20%
  [7, 30], // +7 -> +8: 30%
  [8, 40], // +8 -> +9: 40%
  [9, 50], // +9 -> +10: 50%
]);

export function enhanceItem(currentLevel: number, useProtection: boolean = false): EnhancementResult {
  const maxLevel = 10;

  if (currentLevel >= maxLevel) {
    return {
      success: false,
      newLevel: currentLevel,
      itemDestroyed: false,
      message: '이미 최대 강화 레벨입니다.',
    };
  }

  const successRate = ENHANCEMENT_RATES.get(currentLevel) || 10;
  const destructionRate = useProtection ? 0 : (DESTRUCTION_RATES.get(currentLevel) || 0);

  const roll = Math.random() * 100;

  if (roll < successRate) {
    // 성공
    return {
      success: true,
      newLevel: currentLevel + 1,
      itemDestroyed: false,
      message: `강화 성공! +${currentLevel + 1}`,
    };
  } else {
    // 실패
    const destructionRoll = Math.random() * 100;
    if (destructionRoll < destructionRate) {
      // 파괴
      return {
        success: false,
        newLevel: 0,
        itemDestroyed: true,
        message: '강화 실패... 장비가 파괴되었습니다!',
      };
    } else {
      // 실패 (레벨 하락)
      return {
        success: false,
        newLevel: Math.max(0, currentLevel - 1),
        itemDestroyed: false,
        message: `강화 실패... +${Math.max(0, currentLevel - 1)}로 하락했습니다.`,
      };
    }
  }
}

export function getEnhancementCost(currentLevel: number): number {
  return 100 * Math.pow(2, currentLevel); // 기하급수적 증가
}

