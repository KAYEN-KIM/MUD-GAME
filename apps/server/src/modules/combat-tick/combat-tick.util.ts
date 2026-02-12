import { CombatStats } from './combat-tick.types';

/**
 * 개선된 데미지 계산 공식
 * - 공격력과 방어력의 차이를 기반으로 데미지 계산
 * - 최소/최대 데미지 보장
 * - 랜덤 요소 추가 (±10%)
 */
export function calculateDamage(attackerStats: CombatStats, defenderStats: CombatStats): number {
  const baseAtk = attackerStats.atk || 10;
  const baseDef = defenderStats.def || 0;
  
  // 기본 데미지 = 공격력 - (방어력 * 0.5)
  let damage = baseAtk - (baseDef * 0.5);
  
  // 최소 데미지 = 공격력의 10%
  const minDamage = Math.max(1, Math.floor(baseAtk * 0.1));
  
  // 최대 데미지 = 공격력의 150%
  const maxDamage = Math.floor(baseAtk * 1.5);
  
  // 범위 제한
  damage = Math.max(minDamage, Math.min(maxDamage, damage));
  
  // 랜덤 요소 (±10%)
  const variance = damage * 0.1;
  damage = damage + (Math.random() * variance * 2 - variance);
  
  return Math.max(1, Math.floor(damage));
}

export function getDefaultPlayerStats(): CombatStats {
  return {
    atk: 10,
    def: 5,
    spd: 10,
  };
}

export function getDefaultMonsterStats(): CombatStats {
  return {
    atk: 6,
    def: 2,
    spd: 8,
  };
}

export function formatCombatLog(
  attackerName: string,
  defenderName: string,
  damage: number,
  defenderHpAfter: number,
  defenderMaxHp: number,
): string {
  return `${attackerName} swings at ${defenderName} for ${damage} damage. (${defenderHpAfter}/${defenderMaxHp} HP)`;
}

export function formatDeathLog(entityName: string, isPlayer: boolean): string {
  if (isPlayer) {
    return `${entityName} is defeated!`;
  }
  return `${entityName} is slain!`;
}

