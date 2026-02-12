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
  tickAt: number; // Actual timestamp when processed (Date.now())
  scheduledAt?: number; // Original scheduled time for drift calculation
  driftMs?: number; // Drift in milliseconds
  lines: string[];
  delta: {
    combatants: Array<{
      combatantId: string;
      hpBefore: number;
      hpAfter: number;
      mpBefore?: number;
      mpAfter?: number;
      healed?: number; // Amount healed (for healing actions)
    }>;
  };
  events: Array<{
    type: 'MONSTER_DEAD' | 'PLAYER_DEAD' | 'COMBAT_START' | 'COMBAT_END' | 'FLEE_SUCCESS' | 'FLEE_FAILED' | 'CAST_START' | 'CAST_COMPLETE';
    combatantId?: string;
    entityId?: string;
    killerId?: string; // ID of killer for quest triggers
    monsterId?: string; // Monster ID for quest triggers
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

