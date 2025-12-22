import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { CombatTickService } from './combat-tick.service';

@Injectable()
export class CombatTickWorker implements OnModuleInit, OnModuleDestroy {
  private intervalHandle: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly combatTickService: CombatTickService,
  ) {}

  onModuleInit() {
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
      await this.processInstance(instance.id);
    }
  }

  private async processInstance(instanceId: string): Promise<void> {
    const lockKey = `lock:combat:${instanceId}`;
    const lockTTL = 5; // 5 seconds
    const lockValue = `${Date.now()}-${Math.random()}`;

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
      const instance = await this.prisma.combatInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance || instance.state !== 'ENGAGED' || instance.nextTickAt > new Date()) {
        // Instance was already processed or state changed
        return;
      }

      // Mark as RESOLVING to prevent double processing
      await this.prisma.combatInstance.update({
        where: { id: instanceId },
        data: { state: 'RESOLVING' },
      });

      // Process the tick
      console.log(`[CombatTickWorker] Processing instance ${instanceId} tick ${instance.tick}`);
      const tickResult = await this.combatTickService.processTick(instanceId);

      // Broadcast the result to clients in the room
      await this.broadcastTick(instance.roomId, tickResult);

      // If combat ended, keep state as ENDED, otherwise set back to ENGAGED
      if (!tickResult.ended) {
        await this.prisma.combatInstance.update({
          where: { id: instanceId },
          data: { state: 'ENGAGED' },
        });
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
    const channel = `combat:tick:${roomId}`;
    await this.redis.getClient().publish(channel, JSON.stringify(result));
  }
}

