import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client?: Redis;
  private useRedis: boolean = true;
  private memoryCache: Map<string, { value: string; expiresAt?: number }> = new Map();

  private ensureClient() {
    if (this.client) return;

    const redisUrl = process.env.REDIS_URL || '';
    
    // Redis URL이 없으면 메모리 캐시 사용
    if (!redisUrl || redisUrl.trim() === '') {
      this.useRedis = false;
      console.log('⚠️ Redis URL이 설정되지 않았습니다. 메모리 캐시를 사용합니다.');
      return;
    }
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('❌ Redis 연결 실패: 최대 재시도 횟수 초과');
          return null; // 재시도 중단
        }
        const delay = Math.min(times * 200, 2000);
        console.log(`🔄 Redis 재연결 시도 ${times}/3 (${delay}ms 후)...`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // 재연결
        }
        return false;
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      console.log('✅ Redis 연결됨');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis 준비됨');
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis 오류:', err.message);
    });

    this.client.on('close', () => {
      console.warn('⚠️ Redis 연결 종료됨');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis 재연결 중...');
    });
  }

  onModuleInit() {
    this.ensureClient();
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  getClient(): Redis {
    if (!this.useRedis) {
      throw new Error('Redis가 사용 불가능합니다. 메모리 캐시를 사용하세요.');
    }
    this.ensureClient();
    return this.client!;
  }

  async get(key: string): Promise<string | null> {
    if (!this.useRedis) {
      const item = this.memoryCache.get(key);
      if (!item) return null;
      if (item.expiresAt && item.expiresAt < Date.now()) {
        this.memoryCache.delete(key);
        return null;
      }
      return item.value;
    }
    
    try {
      return await this.getClient().get(key);
    } catch (err) {
      console.error('Redis get 오류:', err);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.useRedis) {
      const item: { value: string; expiresAt?: number } = { value };
      if (ttl) {
        item.expiresAt = Date.now() + ttl * 1000;
      }
      this.memoryCache.set(key, item);
      return;
    }
    
    try {
      if (ttl) {
        await this.getClient().setex(key, ttl, value);
      } else {
        await this.getClient().set(key, value);
      }
    } catch (err) {
      console.error('Redis set 오류:', err);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.useRedis) {
      this.memoryCache.delete(key);
      return;
    }
    
    try {
      await this.getClient().del(key);
    } catch (err) {
      console.error('Redis del 오류:', err);
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.useRedis) {
      const current = await this.get(key);
      const newValue = (parseInt(current || '0', 10) + 1).toString();
      await this.set(key, newValue);
      return parseInt(newValue, 10);
    }
    
    try {
      return await this.getClient().incr(key);
    } catch (err) {
      console.error('Redis incr 오류:', err);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.useRedis) {
      const item = this.memoryCache.get(key);
      if (item) {
        item.expiresAt = Date.now() + seconds * 1000;
      }
      return;
    }
    
    try {
      await this.getClient().expire(key, seconds);
    } catch (err) {
      console.error('Redis expire 오류:', err);
    }
  }

  async ping(): Promise<string> {
    if (!this.useRedis) {
      return 'PONG (memory cache)';
    }
    
    try {
      return await this.getClient().ping();
    } catch (err) {
      console.error('Redis ping 오류:', err);
      throw err;
    }
  }
}

