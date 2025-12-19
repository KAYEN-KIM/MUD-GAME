import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async checkRateLimit(
    type: string,
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const key = `rl:${type}:${identifier}`;
    const client = this.redis.getClient();

    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttl = await client.ttl(key);
    const resetAt = Date.now() + ttl * 1000;
    const remaining = Math.max(0, maxRequests - count);

    return {
      allowed: count <= maxRequests,
      remaining,
      resetAt,
    };
  }

  async checkChatRateLimit(characterId: string): Promise<RateLimitResult> {
    const maxPerSec = parseInt(process.env.RL_CHAT_PER_SEC || '1', 10);
    return this.checkRateLimit('chat', characterId, maxPerSec, 1);
  }

  async checkMoveRateLimit(characterId: string): Promise<RateLimitResult> {
    // 테스트 모드에서는 이동 레이트 리밋을 완전히 해제하여
    // E2E / smoke 테스트의 플래키니스(flaky)를 방지한다.
    if (process.env.TEST_MODE === 'true') {
      const now = Date.now();
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: now,
      };
    }

    const maxPerSec = parseInt(process.env.RL_MOVE_PER_SEC || '3', 10);
    return this.checkRateLimit('move', characterId, maxPerSec, 1);
  }

  async checkCombatTurnRateLimit(characterId: string): Promise<RateLimitResult> {
    const maxPerSec = parseInt(process.env.RL_COMBAT_TURN_PER_SEC || '2', 10);
    return this.checkRateLimit('combat_turn', characterId, maxPerSec, 1);
  }

  async checkHuntCooldown(characterId: string): Promise<boolean> {
    const key = `cd:hunt:${characterId}`;
    const exists = await this.redis.get(key);
    if (exists) {
      return false;
    }

    const cdMs = parseInt(process.env.CD_HUNT_MS || '2000', 10);
    await this.redis.set(key, '1', Math.ceil(cdMs / 1000));
    return true;
  }
}

