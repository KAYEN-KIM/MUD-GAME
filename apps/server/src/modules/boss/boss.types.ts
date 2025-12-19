export interface BossSpawnConfig {
  roomId: string;
  bossId: string;
  cooldownSec: number;
  reward: {
    expMult: number;
    goldMult: number;
  };
  rewardItemsGuaranteed?: Array<{
    itemId: string;
    qty: number;
  }>;
  whenCooldown: 'FALLBACK_NORMAL';
}

export interface BossSpawnsData {
  version: number;
  spawns: BossSpawnConfig[];
}

