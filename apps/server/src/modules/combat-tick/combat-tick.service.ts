import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CombatTickResult, EnqueueActionParams, CombatStats } from './combat-tick.types';
import {
  calculateDamage,
  formatCombatLog,
  formatDeathLog,
  getDefaultPlayerStats,
  getDefaultMonsterStats,
} from './combat-tick.util';
import { getSpell } from './spell-registry';

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
          // MP는 Character의 mp를 사용하거나, 없으면 intStat 기반으로 계산
          mp: (character as any).mp ?? (character.intStat || 20) * 10,
          maxMp: (character as any).mpMax ?? (character.intStat || 20) * 10,
          statsSnapshot: JSON.stringify(playerStats),
          nextActionAt: new Date(now.getTime() + roundtimeMs),
          nextAutoAttackAt: new Date(now.getTime() + autoswingMs),
          status: JSON.stringify({}),
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
          statsSnapshot: JSON.stringify(monsterStats),
          nextActionAt: new Date(now.getTime() + roundtimeMs),
          nextAutoAttackAt: new Date(now.getTime() + autoswingMs),
          status: JSON.stringify({}),
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
        payload: JSON.stringify(payload || {}),
        reqId,
        seq: nextSeq,
      },
    });
  }

  /**
   * Process a single tick for the given instance
   * This should be called by the tick worker
   * @param instanceId - Combat instance ID
   * @param scheduledAt - Original scheduled time for drift telemetry (optional)
   */
  async processTick(instanceId: string, scheduledAt?: Date): Promise<CombatTickResult> {
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

    // Process statuses: remove expired buffs/debuffs/shields
    const nowMs = now.getTime();
    for (const combatant of instance.combatants) {
      if (combatant.hp <= 0) continue;

      const status = JSON.parse((combatant.status as string) || '{}') as any;
      let updated = false;
      const newStatus: any = { ...status };

      // Remove expired buffs
      if (status.buffs && Array.isArray(status.buffs)) {
        const activeBuffs = status.buffs.filter((buff: any) => buff.expiresAt > nowMs);
        if (activeBuffs.length !== status.buffs.length) {
          newStatus.buffs = activeBuffs;
          updated = true;
        }
      }

      // Remove expired debuffs
      if (status.debuffs && Array.isArray(status.debuffs)) {
        const activeDebuffs = status.debuffs.filter((debuff: any) => debuff.expiresAt > nowMs);
        if (activeDebuffs.length !== status.debuffs.length) {
          newStatus.debuffs = activeDebuffs;
          updated = true;
        }
      }

      // Remove expired shields
      if (status.shields && Array.isArray(status.shields)) {
        const activeShields = status.shields.filter((shield: any) => shield.expiresAt > nowMs);
        if (activeShields.length !== status.shields.length) {
          newStatus.shields = activeShields;
          updated = true;
        }
      }

      if (updated) {
        await this.prisma.combatCombatant.update({
          where: { id: combatant.id },
          data: { status: JSON.stringify(newStatus) },
        });
        combatant.status = JSON.stringify(newStatus);
      }
    }

    // Process ongoing casts (check for completion)
    for (const combatant of instance.combatants) {
      if (combatant.hp <= 0) continue;

      const casting = combatant.casting ? JSON.parse(combatant.casting as string) as any : null;
      if (casting && casting.completesAt) {
        // Handle both ISO string and timestamp number
        const completesAtMs = typeof casting.completesAt === 'string' 
          ? new Date(casting.completesAt).getTime()
          : casting.completesAt;
        if (completesAtMs <= now.getTime()) {
          // Cast completes
          await this.executeCastComplete(combatant, casting, instance.combatants, lines, delta, events);
          // Clear casting state
          await this.prisma.combatCombatant.update({
            where: { id: combatant.id },
            data: { casting: null as any },
          });
        }
      }
    }

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
      } else if (action.type === 'USE_ITEM') {
        const payload = action.payload ? JSON.parse(action.payload as string) : {};
        await this.executeUseItem(combatant, payload, instance.combatants, lines, delta, events);
        // Update nextActionAt
        await this.prisma.combatCombatant.update({
          where: { id: combatant.id },
          data: { nextActionAt: new Date(now.getTime() + roundtimeMs) },
        });
      } else if (action.type === 'CAST') {
        const payload = action.payload ? JSON.parse(action.payload as string) : {};
        await this.executeCastStart(combatant, payload, instance.combatants, lines, delta, events);
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

      // Update character HP and MP for all players
      for (const playerCombatant of instance.combatants.filter((c) => c.entityType === 'PLAYER')) {
        await this.prisma.character.update({
          where: { id: playerCombatant.entityId },
          data: {
            hp: playerCombatant.hp,
            mp: playerCombatant.mp, // MP도 업데이트
          } as any,
        });
      }

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
      // Advance tick with monotonic scheduling
      const nextTick = instance.tick + 1;
      // Monotonic: derive next tick from previous schedule, not current time
      const previousSchedule = instance.nextTickAt;
      const nextTickAt = new Date(previousSchedule.getTime() + tickMs);

      await this.prisma.combatInstance.update({
        where: { id: instanceId },
        data: {
          tick: nextTick,
          nextTickAt,
        },
      });
    }

    const actualNow = new Date();
    const driftMs = scheduledAt ? actualNow.getTime() - scheduledAt.getTime() : 0;

    return {
      instanceId,
      tick: instance.tick,
      tickAt: actualNow.getTime(),
      scheduledAt: scheduledAt?.getTime(),
      driftMs,
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

    let attackerStats = attacker.statsSnapshot ? JSON.parse(attacker.statsSnapshot) as CombatStats : getDefaultPlayerStats();
    let defenderStats = target.statsSnapshot ? JSON.parse(target.statsSnapshot) as CombatStats : getDefaultMonsterStats();

    // Apply buffs/debuffs to stats
    const attackerStatus = JSON.parse(attacker.status || '{}') as any;
    const defenderStatus = JSON.parse(target.status || '{}') as any;

    // Apply attacker buffs (e.g., strength boost)
    if (attackerStatus.buffs && Array.isArray(attackerStatus.buffs)) {
      for (const buff of attackerStatus.buffs) {
        if (buff.spellId === 'strength') {
          attackerStats = { ...attackerStats, atk: attackerStats.atk + (buff.effect || 0) };
        }
      }
    }

    // Apply defender debuffs (e.g., weakness)
    if (defenderStatus.debuffs && Array.isArray(defenderStatus.debuffs)) {
      for (const debuff of defenderStatus.debuffs) {
        if (debuff.spellId === 'weakness') {
          defenderStats = { ...defenderStats, def: Math.max(0, defenderStats.def - (debuff.effect || 0)) };
        }
      }
    }

    let damage = calculateDamage(attackerStats, defenderStats);

    // Apply shields to reduce damage
    if (defenderStatus.shields && Array.isArray(defenderStatus.shields)) {
      let totalShieldAbsorption = 0;
      for (const shield of defenderStatus.shields) {
        totalShieldAbsorption += shield.absorption || 0;
      }
      if (totalShieldAbsorption > 0) {
        const originalDamage = damage;
        damage = Math.max(0, damage - totalShieldAbsorption);
        // Reduce shield absorption
        const updatedShields = defenderStatus.shields.map((shield: any) => {
          const absorptionUsed = Math.min(shield.absorption, originalDamage);
          return {
            ...shield,
            absorption: shield.absorption - absorptionUsed,
          };
        }).filter((shield: any) => shield.absorption > 0);

        await this.prisma.combatCombatant.update({
          where: { id: target.id },
          data: {
            status: JSON.stringify({
              ...defenderStatus,
              shields: updatedShields,
            }),
          },
        });

        if (damage < originalDamage) {
          const targetName = await this.getCombatantName(target);
          lines.push(`${targetName}'s shield absorbs ${originalDamage - damage} damage!`);
        }
      }
    }

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
      events.push({ 
        type: eventType, 
        combatantId: target.id, 
        entityId: target.entityId,
        killerId: attacker.entityId, // Track killer for quest triggers
        monsterId: target.entityType === 'MONSTER' ? target.entityId : undefined,
      });

      // Update character HP if player
      if (target.entityType === 'PLAYER') {
        await this.prisma.character.update({
          where: { id: target.entityId },
          data: { hp: 0 },
        });
      }
    }
  }

  private async executeUseItem(
    user: any,
    payload: any,
    allCombatants: any[],
    lines: string[],
    delta: any,
    events: any[],
  ): Promise<void> {
    const { itemId } = payload;

    if (!itemId) {
      return;
    }

    // Fetch item details
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item || item.type !== 'consumable') {
      return;
    }

    const effectJson = (item as any).effectString ? JSON.parse((item as any).effectString) as any : null;
    if (!effectJson || (!effectJson.heal && !effectJson.mpRestore)) {
      return;
    }

    // Calculate healing and MP restoration
    const hpBefore = user.hp;
    const mpBefore = user.mp;
    const healRaw = effectJson.heal || 0;
    const mpRestoreRaw = effectJson.mpRestore || 0;
    const healed = Math.min(healRaw, user.maxHp - hpBefore);
    const mpRestored = Math.min(mpRestoreRaw, user.maxMp - mpBefore);
    const hpAfter = hpBefore + healed;
    const mpAfter = mpBefore + mpRestored;

    // Apply healing and MP restoration
    await this.prisma.combatCombatant.update({
      where: { id: user.id },
      data: { hp: hpAfter, mp: mpAfter },
    });

    user.hp = hpAfter;
    user.mp = mpAfter;

    // Update character HP and MP if player
    if (user.entityType === 'PLAYER') {
      await this.prisma.character.update({
        where: { id: user.entityId },
        data: { hp: hpAfter, mp: mpAfter } as any,
      });
    }

    const userName = await this.getCombatantName(user);
    
    // Build message
    const effects = [];
    if (healed > 0) {
      effects.push(`HP +${healed}`);
    }
    if (mpRestored > 0) {
      effects.push(`MP +${mpRestored}`);
    }
    
    if (effects.length > 0) {
      lines.push(`${userName} uses ${item.name}. ${effects.join(', ')} (HP: ${hpAfter}/${user.maxHp}, MP: ${mpAfter}/${user.maxMp})`);
    } else {
      lines.push(`${userName} uses ${item.name} but is already at full health and mana.`);
    }

    // Add to delta with healed and mpRestored amounts
    const existingDelta = delta.combatants.find((d: any) => d.combatantId === user.id);
    if (existingDelta) {
      existingDelta.hpAfter = hpAfter;
      existingDelta.mpAfter = mpAfter;
      existingDelta.healed = healed;
      existingDelta.mpRestored = mpRestored;
    } else {
      delta.combatants.push({
        combatantId: user.id,
        hpBefore,
        hpAfter,
        mpBefore,
        mpAfter,
        healed,
        mpRestored,
      });
    }
  }

  private async executeCastStart(
    caster: any,
    payload: any,
    allCombatants: any[],
    lines: string[],
    delta: any,
    events: any[],
  ): Promise<void> {
    const { spellId, targetId } = payload;

    const spell = getSpell(spellId);
    if (!spell) {
      lines.push(`${await this.getCombatantName(caster)} attempts to cast an unknown spell.`);
      return;
    }

    // Check MP cost
    if (caster.mp < spell.mpCost) {
      const casterName = await this.getCombatantName(caster);
      lines.push(`${casterName} doesn't have enough MP to cast ${spell.name}! (Need ${spell.mpCost}, have ${caster.mp})`);
      return;
    }

    // Check cooldown
    const status = JSON.parse(caster.status || '{}') as any;
    const lastCastTimes = status.lastCastTimes || {};
    const lastCastTime = lastCastTimes[spell.id] || 0;
    const now = Date.now();
    if (spell.cooldownMs > 0 && (now - lastCastTime) < spell.cooldownMs) {
      const remainingCooldown = Math.ceil((spell.cooldownMs - (now - lastCastTime)) / 1000);
      const casterName = await this.getCombatantName(caster);
      lines.push(`${casterName} cannot cast ${spell.name} yet! (Cooldown: ${remainingCooldown}s remaining)`);
      return;
    }

    // Deduct MP immediately
    const newMp = caster.mp - spell.mpCost;
    const completesAt = now + spell.castTimeMs;

    // Update last cast time
    lastCastTimes[spell.id] = now;

    // Set casting state and deduct MP
    await this.prisma.combatCombatant.update({
      where: { id: caster.id },
      data: {
        mp: newMp,
        status: JSON.stringify({
          ...status,
          lastCastTimes,
        }),
        casting: JSON.stringify({
          spellId: spell.id,
          spellName: spell.name,
          targetId: targetId || caster.id,
          completesAt, // Store as timestamp (number)
        }),
        nextActionAt: new Date(now + spell.castTimeMs + spell.roundtimeMs),
      },
    });

    caster.mp = newMp;

    const casterName = await this.getCombatantName(caster);
    lines.push(`${casterName} begins casting '${spell.name}'... (MP: ${newMp}/${caster.maxMp})`);
    events.push({ type: 'CAST_START', combatantId: caster.id });
  }

  private async executeCastComplete(
    caster: any,
    casting: any,
    allCombatants: any[],
    lines: string[],
    delta: any,
    events: any[],
  ): Promise<void> {
    const spell = getSpell(casting.spellId);
    if (!spell) {
      return;
    }

    const casterName = await this.getCombatantName(caster);

    if (spell.type === 'DAMAGE') {
      // Find target
      const target = allCombatants.find((c) => c.id === casting.targetId);
      if (!target || target.hp <= 0) {
        lines.push(`${casterName} casts ${spell.name}, but the target is gone!`);
        return;
      }

      // Calculate damage with variance
      const variance = Math.floor((Math.random() * 6) - 2); // -2 to +3
      const damage = Math.max(1, spell.power + variance);
      const newHp = Math.max(0, target.hp - damage);

      await this.prisma.combatCombatant.update({
        where: { id: target.id },
        data: { hp: newHp },
      });

      target.hp = newHp;

      const targetName = await this.getCombatantName(target);
      lines.push(`${casterName}'s ${spell.name} strikes ${targetName} for ${damage} damage! (${newHp}/${target.maxHp})`);

      if (newHp <= 0) {
        lines.push(formatDeathLog(targetName, target.entityType === 'PLAYER'));
        const eventType = target.entityType === 'PLAYER' ? 'PLAYER_DEAD' : 'MONSTER_DEAD';
        events.push({
          type: eventType,
          combatantId: target.id,
          entityId: target.entityId,
          killerId: caster.entityId,
          monsterId: target.entityType === 'MONSTER' ? target.entityId : undefined,
        });

        // Update character HP if player
        if (target.entityType === 'PLAYER') {
          await this.prisma.character.update({
            where: { id: target.entityId },
            data: { hp: 0 },
          });
        }
      }
    } else if (spell.type === 'HEAL') {
      // Heal self
      const hpBefore = caster.hp;
      const healRaw = spell.power;
      const healed = Math.min(healRaw, caster.maxHp - hpBefore);
      const hpAfter = hpBefore + healed;

      await this.prisma.combatCombatant.update({
        where: { id: caster.id },
        data: { hp: hpAfter },
      });

      caster.hp = hpAfter;

      // Update character HP if player
      if (caster.entityType === 'PLAYER') {
        await this.prisma.character.update({
          where: { id: caster.entityId },
          data: { hp: hpAfter },
        });
      }

      lines.push(`${casterName} completes ${spell.name}. HP +${healed} (${hpAfter}/${caster.maxHp})`);

      // Add to delta
      const existingDelta = delta.combatants.find((d: any) => d.combatantId === caster.id);
      if (existingDelta) {
        existingDelta.hpAfter = hpAfter;
        existingDelta.healed = healed;
      } else {
        delta.combatants.push({
          combatantId: caster.id,
          hpBefore,
          hpAfter,
          healed,
        });
      }
    } else if (spell.type === 'SHIELD') {
      // Apply shield to self
      const status = JSON.parse(caster.status || '{}') as any;
      const shields = status.shields || [];
      const shieldExpiresAt = Date.now() + (spell.durationMs || 30000);
      
      shields.push({
        spellId: spell.id,
        spellName: spell.name,
        absorption: spell.power,
        expiresAt: shieldExpiresAt,
      });

      await this.prisma.combatCombatant.update({
        where: { id: caster.id },
        data: {
          status: JSON.stringify({
            ...status,
            shields,
          }),
        },
      });

      lines.push(`${casterName} completes ${spell.name}. A protective shield forms! (Absorbs ${spell.power} damage)`);
    } else if (spell.type === 'BUFF') {
      // Apply buff to self
      const status = JSON.parse(caster.status || '{}') as any;
      const buffs = status.buffs || [];
      const buffExpiresAt = Date.now() + (spell.durationMs || 60000);
      
      buffs.push({
        spellId: spell.id,
        spellName: spell.name,
        effect: spell.power, // e.g., attack boost
        expiresAt: buffExpiresAt,
      });

      await this.prisma.combatCombatant.update({
        where: { id: caster.id },
        data: {
          status: JSON.stringify({
            ...status,
            buffs,
          }),
        },
      });

      lines.push(`${casterName} completes ${spell.name}. Attack power increased by ${spell.power}!`);
    } else if (spell.type === 'DEBUFF') {
      // Apply debuff to target
      const target = allCombatants.find((c) => c.id === casting.targetId);
      if (!target || target.hp <= 0) {
        lines.push(`${casterName} casts ${spell.name}, but the target is gone!`);
        return;
      }

      const status = JSON.parse(target.status || '{}') as any;
      const debuffs = status.debuffs || [];
      const debuffExpiresAt = Date.now() + (spell.durationMs || 45000);
      
      debuffs.push({
        spellId: spell.id,
        spellName: spell.name,
        effect: spell.power, // e.g., defense reduction
        expiresAt: debuffExpiresAt,
      });

      await this.prisma.combatCombatant.update({
        where: { id: target.id },
        data: {
          status: JSON.stringify({
            ...status,
            debuffs,
          }),
        },
      });

      const targetName = await this.getCombatantName(target);
      lines.push(`${casterName}'s ${spell.name} weakens ${targetName}! Defense reduced by ${spell.power}.`);
    }

    events.push({ type: 'CAST_COMPLETE', combatantId: caster.id });
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

