import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { CombatTickService } from './combat-tick.service';
import { QuestService } from '../quest/quest.service';
import { ProgressionService } from '../progression/progression.service';

@Injectable()
export class CombatTickWorker implements OnModuleInit, OnModuleDestroy {
  private intervalHandle: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly combatTickService: CombatTickService,
    private readonly questService: QuestService,
    private readonly progressionService: ProgressionService,
  ) {}

  onModuleInit() {
    // 현재 스키마/마이그레이션에서 combat_tick 테이블군이 항상 존재하는 것이 보장되지 않음.
    // 개발 환경에서 서버가 스팸 에러로 오염되는 것을 막기 위해 기본 비활성화한다.
    // 필요 시 `.env`에 COMBAT_TICK_ENABLED=true 로 활성화.
    const enabled = (process.env.COMBAT_TICK_ENABLED || 'false').toLowerCase() === 'true';
    if (!enabled) {
      console.log('[CombatTickWorker] Disabled (COMBAT_TICK_ENABLED=false)');
      return;
    }

    const pollMs = parseInt(process.env.COMBAT_TICK_POLL_MS || '250', 10);
    console.log(`[CombatTickWorker] Starting with poll interval: ${pollMs}ms`);

    this.intervalHandle = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[CombatTickWorker] Error in tick:', err);
      });
    }, pollMs);
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    console.log('[CombatTickWorker] Stopped');
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const now = new Date();

    // Find all instances that are due for processing
    const dueInstances = await this.prisma.combatInstance.findMany({
      where: {
        state: 'ENGAGED',
        nextTickAt: {
          lte: now,
        },
      },
      take: 10, // Process up to 10 instances per poll
    });

    for (const instance of dueInstances) {
      await this.processInstance(instance.id, now);
    }
  }

  private async processInstance(instanceId: string, now: Date): Promise<void> {
    const lockKey = `lock:combat:${instanceId}`;
    const lockTTL = parseInt(process.env.REDLOCK_TTL_MS || '5000', 10) / 1000; // Convert to seconds
    const lockValue = `${Date.now()}-${Math.random()}`;
    const maxCatchupTicks = parseInt(process.env.COMBAT_MAX_CATCHUP_TICKS || '3', 10);

    let acquired = false;

    try {
      // Try to acquire distributed lock
      const lockResult = await this.redis.getClient().set(lockKey, lockValue, 'EX', lockTTL, 'NX');

      if (lockResult !== 'OK') {
        // Another worker has the lock
        return;
      }

      acquired = true;

      // Re-check instance is still due (double-check locking)
      let instance = await this.prisma.combatInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance || instance.state !== 'ENGAGED' || instance.nextTickAt > now) {
        // Instance was already processed or state changed
        return;
      }

      // Bounded catch-up: process up to maxCatchupTicks ticks if behind
      let ticksProcessed = 0;
      const tickMs = parseInt(process.env.COMBAT_TICK_MS || '2000', 10);

      while (instance && instance.state === 'ENGAGED' && instance.nextTickAt <= now && ticksProcessed < maxCatchupTicks) {
        // Mark as RESOLVING to prevent double processing
        await this.prisma.combatInstance.update({
          where: { id: instanceId },
          data: { state: 'RESOLVING' },
        });

        // Calculate drift for telemetry
        const scheduledAt = instance.nextTickAt;
        const actualAt = now;
        const driftMs = actualAt.getTime() - scheduledAt.getTime();

        if (driftMs > 500) {
          console.warn(`[CombatTickWorker] High drift detected: instance=${instanceId.substring(0, 8)} tick=${instance.tick} drift=${driftMs}ms`);
        }

        console.log(`[CombatTickWorker] Processing instance ${instanceId.substring(0, 8)} tick ${instance.tick} (drift: ${driftMs}ms)`);

        // Process the tick with scheduled timestamp for telemetry
        const tickResult = await this.combatTickService.processTick(instanceId, scheduledAt);

        // Process quest triggers for monster kills
        for (const event of tickResult.events) {
          if (event.type === 'MONSTER_DEAD' && event.killerId && event.monsterId) {
            try {
              // Get room info for quest context
              const room = await this.prisma.room.findUnique({
                where: { id: instance.roomId },
                select: { zoneId: true },
              });

              await this.questService.onCombatEnd(event.killerId, {
                zoneId: room?.zoneId || undefined,
                monsterId: event.monsterId,
                isBoss: false,
              });

              // 경험치 및 골드 보상 처리
              const monster = await this.prisma.monster.findUnique({
                where: { id: event.monsterId },
              });

              if (monster) {
                // 경험치 계산: 레벨 * 10 * (1 + 레벨 * 0.1)
                const expGained = Math.floor(monster.level * 10 * (1 + monster.level * 0.1));
                // 골드 계산: 레벨 * 5 * (1 + 랜덤 0-50%)
                const goldGained = Math.floor(monster.level * 5 * (1 + Math.random() * 0.5));

                try {
                  // 경험치 추가 및 레벨업 처리
                  const { leveledUp, results } = await this.progressionService.addExp(
                    event.killerId,
                    expGained,
                  );

                  // 골드 추가
                  await this.prisma.character.update({
                    where: { id: event.killerId },
                    data: { gold: { increment: goldGained } },
                  });

                  // 레벨업 이벤트 브로드캐스트
                  if (leveledUp && results.length > 0) {
                    try {
                      const client = this.redis.getClient();
                      await client.publish(
                        `combat:tick:${instance.roomId}`,
                        JSON.stringify({
                          type: 'LEVEL_UP',
                          characterId: event.killerId,
                          results,
                          expGained,
                          goldGained,
                          monsterName: monster.name,
                        }),
                      );
                    } catch (error) {
                      // Redis가 없어도 계속 진행 (단일 서버 환경에서는 문제 없음)
                      console.warn('[CombatTickWorker] Redis publish 실패 (무시됨):', error);
                    }
                  }
                } catch (error) {
                  console.error('[CombatTickWorker] Failed to process exp/levelup:', error);
                }
              }
            } catch (error) {
              console.error('[CombatTickWorker] Failed to process quest trigger:', error);
            }
          }
        }

        // Broadcast the result to clients in the room
        await this.broadcastTick(instance.roomId, tickResult);

        ticksProcessed++;

        // If combat ended, break
        if (tickResult.ended) {
          break;
        }

        // Re-fetch to check if more ticks are due (monotonic scheduling handled in processTick)
        instance = await this.prisma.combatInstance.findUnique({
          where: { id: instanceId },
        });

        // If still engaged, set back to ENGAGED state for next tick
        if (instance && instance.state === 'RESOLVING' && !tickResult.ended) {
          await this.prisma.combatInstance.update({
            where: { id: instanceId },
            data: { state: 'ENGAGED' },
          });
        }
      }

      if (ticksProcessed >= maxCatchupTicks && instance && instance.nextTickAt <= now) {
        console.warn(`[CombatTickWorker] Hit catch-up limit: instance=${instanceId.substring(0, 8)} processed=${ticksProcessed} maxCatchup=${maxCatchupTicks}`);
      }
    } catch (error) {
      console.error(`[CombatTickWorker] Error processing instance ${instanceId}:`, error);

      // Reset state on error
      try {
        await this.prisma.combatInstance.update({
          where: { id: instanceId },
          data: { state: 'ENGAGED' },
        });
      } catch (e) {
        console.error(`[CombatTickWorker] Failed to reset instance state:`, e);
      }
    } finally {
      // Release lock
      if (acquired) {
        try {
          // Only delete if we still own the lock
          const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            else
              return 0
            end
          `;
          await this.redis.getClient().eval(script, 1, lockKey, lockValue);
        } catch (e) {
          console.error('[CombatTickWorker] Failed to release lock:', e);
        }
      }
    }
  }

  private async broadcastTick(roomId: string, result: any): Promise<void> {
    // This will be implemented via the WS gateway
    // For now, we'll emit to Redis pub/sub or use a shared event bus
    // Since we have direct access to the gateway instance through the module,
    // we'll call a method on the gateway directly (see combat-tick.module.ts)

    // Store result in Redis for gateway to pick up
    try {
      const channel = `combat:tick:${roomId}`;
      await this.redis.getClient().publish(channel, JSON.stringify(result));
    } catch (error) {
      // Redis가 없어도 계속 진행 (단일 서버 환경에서는 문제 없음)
      console.warn('[CombatTickWorker] Redis publish 실패 (무시됨):', error);
    }
  }
}

