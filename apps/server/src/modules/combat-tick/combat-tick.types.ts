// Tick-based combat types

export interface CombatStats {
  atk: number;
  def: number;
  spd?: number;
  [key: string]: any; // Allow additional properties for JSON compatibility
}

export interface CombatTickResult {
  instanceId: string;
  tick: number;
  lines: string[];
  delta: {
    combatants: Array<{
      combatantId: string;
      hpBefore: number;
      hpAfter: number;
      mpBefore?: number;
      mpAfter?: number;
    }>;
  };
  events: Array<{
    type: 'MONSTER_DEAD' | 'PLAYER_DEAD' | 'COMBAT_START' | 'COMBAT_END' | 'FLEE_SUCCESS' | 'FLEE_FAILED';
    combatantId?: string;
    entityId?: string;
  }>;
  ended: boolean;
}

export interface EnqueueActionParams {
  combatantId: string;
  instanceId: string;
  type: 'ATTACK' | 'USE_ITEM' | 'FLEE' | 'CAST';
  payload?: any;
  reqId: string;
}

