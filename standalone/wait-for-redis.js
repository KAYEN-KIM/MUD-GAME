// Redis 연결 대기 스크립트
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const maxAttempts = 30;
const delayMs = 1000;

async function waitForRedis() {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      
      await client.connect();
      await client.ping();
      await client.quit();
      
      console.log('✅ Redis 연결 확인됨!');
      process.exit(0);
    } catch (err) {
      console.log(`Redis 연결 시도 ${i + 1}/${maxAttempts}...`);
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('❌ Redis 연결 실패: 최대 시도 횟수 초과');
        process.exit(1);
      }
    }
  }
}

waitForRedis();
