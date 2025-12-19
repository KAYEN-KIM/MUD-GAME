import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL);

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

// 레이트 리밋 키 생성
export function getRateLimitKey(type: string, identifier: string): string {
  return `ratelimit:${type}:${identifier}`;
}

// 쿨다운 키 생성
export function getCooldownKey(type: string, identifier: string): string {
  return `cooldown:${type}:${identifier}`;
}

// 전투 상태 키 생성
export function getEncounterKey(encounterId: string): string {
  return `encounter:${encounterId}`;
}

// 파티 상태 키 생성
export function getPartyKey(partyId: string): string {
  return `party:${partyId}`;
}

