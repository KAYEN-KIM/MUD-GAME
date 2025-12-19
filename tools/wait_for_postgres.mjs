#!/usr/bin/env node
/**
 * wait_for_postgres.mjs
 * 
 * PostgreSQL이 준비될 때까지 대기하는 스크립트
 * - Docker Compose postgres 서비스가 healthy 상태가 될 때까지 재시도
 * - Windows/Linux/CI 공용
 * 
 * Usage:
 *   node tools/wait_for_postgres.mjs
 */

import { Client } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

// .env 로드 (apps/server/.env)
config({ path: resolve('apps/server/.env') });

const MAX_RETRIES = 60;
const RETRY_INTERVAL_MS = 1000;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
  console.error('   apps/server/.env 파일을 확인해주세요.');
  process.exit(1);
}

async function checkPostgres() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (err) {
    await client.end().catch(() => {});
    return false;
  }
}

async function waitForPostgres() {
  console.log('⏳ PostgreSQL 준비 대기 중...');
  console.log(`   최대 ${MAX_RETRIES}초 동안 ${RETRY_INTERVAL_MS}ms 간격으로 재시도합니다.`);
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const isReady = await checkPostgres();
    
    if (isReady) {
      console.log(`✅ PostgreSQL 준비 완료! (${attempt}/${MAX_RETRIES} 시도)`);
      return true;
    }
    
    if (attempt < MAX_RETRIES) {
      process.stdout.write(`   시도 ${attempt}/${MAX_RETRIES} 실패, 재시도 중...\r`);
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
  
  console.error(`\n❌ PostgreSQL 준비 실패: ${MAX_RETRIES}초 타임아웃`);
  return false;
}

// 실행
const ready = await waitForPostgres();
process.exit(ready ? 0 : 1);

