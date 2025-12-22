import { CombatStats } from './combat-tick.types';

export function calculateDamage(attackerStats: CombatStats, defenderStats: CombatStats): number {
  const baseAtk = attackerStats.atk || 10;
  const baseDef = defenderStats.def || 5;
  const variance = Math.floor(Math.random() * 5) - 2; // -2 to +2
  const damage = Math.max(1, baseAtk - baseDef + variance);
  return damage;
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

