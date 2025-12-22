import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CombatTickResult, EnqueueActionParams, CombatStats } from './combat-tick.types';
import {
  calculateDamage,
  formatCombatLog,
  formatDeathLog,
  getDefaultPlayerStats,
  getDefaultMonsterStats,
} from './combat-tick.util';

@Injectable()
export class CombatTickService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure a combat instance exists for the given room. If none exists or ended, create a new one.
   */
  async ensureInstanceForRoom(roomId: string): Promise<any> {
    const tickMs = parseInt(process.env.COMBAT_TICK_MS || '2000', 10);

    // Check for existing engaged instance
    let instance = await this.prisma.combatInstance.findFirst({
      where: {
        roomId,
        state: { in: ['ENGAGED', 'RESOLVING'] },
      },
      include: {
        combatants: true,
      },
    });

    if (!instance) {
      // Create new instance
      const nextTickAt = new Date(Date.now() + tickMs);
      instance = await this.prisma.combatInstance.create({
        data: {
          roomId,
          state: 'ENGAGED',
          tick: 0,
          nextTickAt,
          seed: Math.floor(Math.random() * 1000000),
        },
        include: {
          combatants: true,
        },
      });
    }

    return instance;
  }

  /**
   * Ensure combatants exist for the given player and monster
   */
  async ensureCombatants(
    instanceId: string,
    playerId: string,
    monsterId: string,
  ): Promise<{ playerCombatant: any; monsterCombatant: any }> {
    const roundtimeMs = parseInt(process.env.COMBAT_ROUNDTIME_MS || '2000', 10);
    const autoswingMs = parseInt(process.env.COMBAT_AUTOSWING_MS || '2000', 10);

    // Fetch player and monster details
    const character = await this.prisma.character.findUnique({
      where: { id: playerId },
      include: { equipment: { include: { item: true } } },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId },
    });

    if (!monster) {
      throw new Error('Monster not found');
    }

    // Check if combatants already exist
    let playerCombatant = await this.prisma.combatCombatant.findFirst({
      where: {
        instanceId,
        entityType: 'PLAYER',
        entityId: playerId,
      },
    });

    let monsterCombatant = await this.prisma.combatCombatant.findFirst({
      where: {
        instanceId,
        entityType: 'MONSTER',
        entityId: monsterId,
      },
    });

    const now = new Date();

    if (!playerCombatant) {
      // Calculate player stats from equipment
      let equipAtk = 0;
      let equipDef = 0;
      for (const eq of character.equipment) {
        equipAtk += eq.item.atk;
        equipDef += eq.item.def;
      }

      const baseAtk = Math.max(1, (character.str || 10));
      const baseDef = Math.max(0, (character.dex || 5));

      const playerStats: CombatStats = {
        atk: baseAtk + equipAtk,
        def: baseDef + equipDef,
        spd: 10,
      };

      playerCombatant = await this.prisma.combatCombatant.create({
        data: {
          instanceId,
          entityType: 'PLAYER',
          entityId: playerId,
          hp: character.hp,
          maxHp: character.hpMax,
          mp: 0,
          maxMp: 0,
          statsSnapshot: playerStats,
          nextActionAt: new Date(now.getTime() + roundtimeMs),
          nextAutoAttackAt: new Date(now.getTime() + autoswingMs),
          status: {},
        },
      });
    }

    if (!monsterCombatant) {
      const monsterStats: CombatStats = {
        atk: monster.atk || 6,
        def: monster.def || 2,
        spd: 8,
      };

      monsterCombatant = await this.prisma.combatCombatant.create({
        data: {
          instanceId,
          entityType: 'MONSTER',
          entityId: monsterId,
          hp: monster.hp,
          maxHp: monster.hp,
          mp: 0,
          maxMp: 0,
          statsSnapshot: monsterStats,
          nextActionAt: new Date(now.getTime() + roundtimeMs),
          nextAutoAttackAt: new Date(now.getTime() + autoswingMs),
          status: {},
        },
      });
    }

    // Set targets if not set
    if (!playerCombatant.targetId) {
      await this.prisma.combatCombatant.update({
        where: { id: playerCombatant.id },
        data: { targetId: monsterCombatant.id },
      });
      playerCombatant.targetId = monsterCombatant.id;
    }

    if (!monsterCombatant.targetId) {
      await this.prisma.combatCombatant.update({
        where: { id: monsterCombatant.id },
        data: { targetId: playerCombatant.id },
      });
      monsterCombatant.targetId = playerCombatant.id;
    }

    return { playerCombatant, monsterCombatant };
  }

  /**
   * Enqueue an action for a combatant
   */
  async enqueueAction(params: EnqueueActionParams): Promise<void> {
    const { combatantId, instanceId, type, payload, reqId } = params;

    // Check for duplicate reqId
    const existing = await this.prisma.combatActionQueue.findUnique({
      where: {
        reqId_combatantId: {
          reqId,
          combatantId,
        },
      },
    });

    if (existing) {
      // Already enqueued
      return;
    }

    // Get current max seq
    const maxSeqResult = await this.prisma.combatActionQueue.findFirst({
      where: { combatantId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });

    const nextSeq = (maxSeqResult?.seq || 0) + 1;

    await this.prisma.combatActionQueue.create({
      data: {
        instanceId,
        combatantId,
        type,
        payload: payload || {},
        reqId,
        seq: nextSeq,
      },
    });
  }

  /**
   * Process a single tick for the given instance
   * This should be called by the tick worker
   */
  async processTick(instanceId: string): Promise<CombatTickResult> {
    const instance = await this.prisma.combatInstance.findUnique({
      where: { id: instanceId },
      include: {
        combatants: true,
        actions: {
          orderBy: { seq: 'asc' },
        },
      },
    });

    if (!instance) {
      throw new Error('Combat instance not found');
    }

    const lines: string[] = [];
    const delta: CombatTickResult['delta'] = { combatants: [] };
    const events: CombatTickResult['events'] = [];

    const now = new Date();
    const tickMs = parseInt(process.env.COMBAT_TICK_MS || '2000', 10);
    const roundtimeMs = parseInt(process.env.COMBAT_ROUNDTIME_MS || '2000', 10);
    const autoswingMs = parseInt(process.env.COMBAT_AUTOSWING_MS || '2000', 10);

    // Track HP changes
    const hpSnapshot = new Map<string, number>();
    for (const combatant of instance.combatants) {
      hpSnapshot.set(combatant.id, combatant.hp);
    }

    // Process statuses (stub for now)

    // Process queued actions (at most 1 per combatant if eligible)
    const processedCombatants = new Set<string>();

    for (const action of instance.actions) {
      if (processedCombatants.has(action.combatantId)) {
        continue;
      }

      const combatant = instance.combatants.find((c) => c.id === action.combatantId);
      if (!combatant || combatant.hp <= 0) {
        continue;
      }

      // Check if action is eligible
      if (combatant.nextActionAt > now) {
        continue;
      }

      processedCombatants.add(action.combatantId);

      // Execute action
      if (action.type === 'ATTACK') {
        await this.executeAttack(combatant, instance.combatants, lines, delta, events);
        // Update nextActionAt
        await this.prisma.combatCombatant.update({
          where: { id: combatant.id },
          data: { nextActionAt: new Date(now.getTime() + roundtimeMs) },
        });
      } else if (action.type === 'FLEE') {
        // Flee attempt
        const fleeSuccess = Math.random() < 0.5;
        if (fleeSuccess) {
          lines.push(`${await this.getCombatantName(combatant)} flees from combat!`);
          events.push({ type: 'FLEE_SUCCESS', combatantId: combatant.id, entityId: combatant.entityId });
          // Remove combatant
          await this.prisma.combatCombatant.update({
            where: { id: combatant.id },
            data: { hp: 0 },
          });
        } else {
          lines.push(`${await this.getCombatantName(combatant)} fails to flee!`);
          events.push({ type: 'FLEE_FAILED', combatantId: combatant.id });
        }
      }

      // Delete processed action
      await this.prisma.combatActionQueue.delete({
        where: { id: action.id },
      });
    }

    // Process autoswing for combatants not already processed
    for (const combatant of instance.combatants) {
      if (combatant.hp <= 0 || processedCombatants.has(combatant.id)) {
        continue;
      }

      // Check if autoswing is ready
      if (combatant.nextAutoAttackAt <= now) {
        await this.executeAttack(combatant, instance.combatants, lines, delta, events);
        // Update nextAutoAttackAt
        await this.prisma.combatCombatant.update({
          where: { id: combatant.id },
          data: { nextAutoAttackAt: new Date(now.getTime() + autoswingMs) },
        });
      }
    }

    // Collect delta
    const updatedCombatants = await this.prisma.combatCombatant.findMany({
      where: { instanceId },
    });

    for (const combatant of updatedCombatants) {
      const hpBefore = hpSnapshot.get(combatant.id) || combatant.hp;
      if (hpBefore !== combatant.hp) {
        delta.combatants.push({
          combatantId: combatant.id,
          hpBefore,
          hpAfter: combatant.hp,
        });
      }
    }

    // Check for combat end
    const alivePlayers = updatedCombatants.filter((c) => c.entityType === 'PLAYER' && c.hp > 0);
    const aliveMonsters = updatedCombatants.filter((c) => c.entityType === 'MONSTER' && c.hp > 0);

    let ended = false;
    if (alivePlayers.length === 0 || aliveMonsters.length === 0) {
      ended = true;
      events.push({ type: 'COMBAT_END' });

      // Apply rewards if player won
      if (alivePlayers.length > 0) {
        lines.push('Victory! You have slain the enemy.');
        // Apply XP/gold rewards here (stub)
      } else {
        lines.push('Defeat! You have been slain.');
      }

      // Update instance state
      await this.prisma.combatInstance.update({
        where: { id: instanceId },
        data: { state: 'ENDED' },
      });
    } else {
      // Advance tick
      const nextTick = instance.tick + 1;
      const nextTickAt = new Date(now.getTime() + tickMs);

      await this.prisma.combatInstance.update({
        where: { id: instanceId },
        data: {
          tick: nextTick,
          nextTickAt,
        },
      });
    }

    return {
      instanceId,
      tick: instance.tick,
      lines,
      delta,
      events,
      ended,
    };
  }

  private async executeAttack(
    attacker: any,
    allCombatants: any[],
    lines: string[],
    delta: any,
    events: any[],
  ): Promise<void> {
    const target = allCombatants.find((c) => c.id === attacker.targetId);
    if (!target || target.hp <= 0) {
      return;
    }

    const attackerStats = (attacker.statsSnapshot as CombatStats) || getDefaultPlayerStats();
    const defenderStats = (target.statsSnapshot as CombatStats) || getDefaultMonsterStats();

    const damage = calculateDamage(attackerStats, defenderStats);

    const newHp = Math.max(0, target.hp - damage);

    await this.prisma.combatCombatant.update({
      where: { id: target.id },
      data: { hp: newHp },
    });

    target.hp = newHp;

    const attackerName = await this.getCombatantName(attacker);
    const defenderName = await this.getCombatantName(target);

    lines.push(formatCombatLog(attackerName, defenderName, damage, newHp, target.maxHp));

    if (newHp <= 0) {
      lines.push(formatDeathLog(defenderName, target.entityType === 'PLAYER'));
      const eventType = target.entityType === 'PLAYER' ? 'PLAYER_DEAD' : 'MONSTER_DEAD';
      events.push({ type: eventType, combatantId: target.id, entityId: target.entityId });

      // Update character HP if player
      if (target.entityType === 'PLAYER') {
        await this.prisma.character.update({
          where: { id: target.entityId },
          data: { hp: 0 },
        });
      }
    }
  }

  private async getCombatantName(combatant: any): Promise<string> {
    if (combatant.entityType === 'PLAYER') {
      const character = await this.prisma.character.findUnique({
        where: { id: combatant.entityId },
        select: { name: true },
      });
      return character?.name || 'Unknown';
    } else {
      const monster = await this.prisma.monster.findUnique({
        where: { id: combatant.entityId },
        select: { name: true },
      });
      return monster?.name || 'Unknown Monster';
    }
  }

  /**
   * End combat for a given instance
   */
  async endCombat(instanceId: string): Promise<void> {
    await this.prisma.combatInstance.update({
      where: { id: instanceId },
      data: { state: 'ENDED' },
    });
  }
}

