import { redis, getRateLimitKey } from './redis';

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

export async function checkRateLimit(
  type: string,
  identifier: string,
  options: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = getRateLimitKey(type, identifier);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % options.windowSeconds);

  const count = await redis.incr(key);
  await redis.expire(key, options.windowSeconds);

  const remaining = Math.max(0, options.maxRequests - count);
  const resetAt = windowStart + options.windowSeconds;

  return {
    allowed: count <= options.maxRequests,
    remaining,
    resetAt
  };
}

// 채팅 레이트 리밋: 10초에 5회
export async function checkChatRateLimit(characterId: string) {
  return checkRateLimit('chat', characterId, {
    windowSeconds: 10,
    maxRequests: 5
  });
}

// 이동 레이트 리밋: 1초에 2회
export async function checkMoveRateLimit(characterId: string) {
  return checkRateLimit('move', characterId, {
    windowSeconds: 1,
    maxRequests: 2
  });
}

// 사냥 레이트 리밋: 5초에 1회
export async function checkHuntRateLimit(characterId: string) {
  return checkRateLimit('hunt', characterId, {
    windowSeconds: 5,
    maxRequests: 1
  });
}

