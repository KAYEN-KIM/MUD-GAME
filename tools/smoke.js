#!/usr/bin/env node

/**
 * MUD 게임 자동 스모크 테스트
 * REST register/login → WS AUTH → PARTY_CREATE → HUNT → COMBAT_END 확인
 */

// ws 패키지 사용
const WebSocket = require('ws');

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

let token = '';
let characterId = '';
let ws = null;
let encounterEnded = false;
let combatEndPayload = null;

async function register() {
  console.log('📝 회원가입 중...');
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `test${Date.now()}@example.com`,
      password: 'test123456',
      characterName: `TestHero${Date.now()}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`회원가입 실패: ${res.status}`);
  }

  const data = await res.json();
  token = data.token;
  characterId = data.character.id;
  console.log(`✅ 회원가입 성공: ${data.character.name}`);
}

async function connectWebSocket() {
  return new Promise((resolve, reject) => {
    console.log('🔌 WebSocket 연결 중...');
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log('✅ WebSocket 연결됨');
      resolve(ws);
    });

    ws.on('error', (error) => {
      reject(error);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      handleMessage(message);
    });
  });
}

function handleMessage(message) {
  switch (message.t) {
    case 'AUTH_OK':
      console.log('✅ 인증 성공');
      break;
    case 'AUTH_FAIL':
      console.error('❌ 인증 실패:', message.p.reason);
      process.exit(1);
      break;
    case 'ENCOUNTER_START':
      console.log('⚔️ 전투 시작!');
      console.log(`   Encounter ID: ${message.p.encounterId}`);
      console.log(`   턴 데드라인: ${new Date(message.p.turnDeadlineAt).toLocaleTimeString()}`);
      break;
    case 'COMBAT_RESOLVE':
      console.log(`📊 턴 ${message.p.turnNo} 해결됨`);
      if (message.p.actions && message.p.actions.length > 0) {
        message.p.actions.forEach((action) => console.log(`   ${action}`));
      }
      break;
    case 'COMBAT_END':
      encounterEnded = true;
      combatEndPayload = message.p;
      console.log('🏁 전투 종료!');
      console.log(`   결과: ${message.p.result}`);
      console.log(`   보상:`, JSON.stringify(message.p.rewards, null, 2));
      break;
    case 'LOG_APPEND':
      if (message.p.scope === 'COMBAT') {
        console.log(`   [${message.p.scope}] ${message.p.text}`);
      }
      break;
    case 'ERROR':
      console.error(`❌ 오류: ${message.p.message}`);
      break;
  }
}

async function sendWSMessage(type, payload = {}) {
  return new Promise((resolve) => {
    const message = {
      t: type,
      reqId: `req_${Date.now()}`,
      ts: Date.now(),
      p: payload,
    };

    ws.send(JSON.stringify(message));
    setTimeout(resolve, 500); // 응답 대기
  });
}

async function main() {
  try {
    // 1. 회원가입
    await register();

    // 2. WebSocket 연결
    await connectWebSocket();

    // 3. AUTH
    await sendWSMessage('AUTH', { token });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. 파티 생성
    console.log('👥 파티 생성 중...');
    await sendWSMessage('PARTY_CREATE', {});
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 5. 사냥 시작
    console.log('🎯 사냥 시작...');
    await sendWSMessage('HUNT', {});
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 6. 전투 종료 대기 (최대 40초)
    console.log('⏳ 전투 진행 대기 중... (최대 40초)');
    const startTime = Date.now();
    const timeout = 40000;

    while (!encounterEnded && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!encounterEnded) {
      console.error('❌ 타임아웃: 전투가 40초 내에 종료되지 않았습니다.');
      process.exit(1);
    }

    // 7. 보상 확인
    if (combatEndPayload && combatEndPayload.rewards) {
      const rewards = combatEndPayload.rewards;
      console.log('\n📦 보상 상세:');
      console.log(`   경험치: ${rewards.expGained || 0}`);
      console.log(`   골드: ${rewards.goldGained || 0}`);
      if (rewards.items && rewards.items.length > 0) {
        console.log(`   아이템:`);
        rewards.items.forEach((item) => {
          console.log(`     - ${item.itemId} x${item.qty}`);
        });
      } else {
        console.log(`   아이템: 없음`);
      }

      // 보상 JSON 출력
      console.log('\n📄 rewardsJson:');
      console.log(JSON.stringify(rewards, null, 2));
    } else {
      console.error('❌ 보상 정보가 없습니다.');
      process.exit(1);
    }

    console.log('\n✅ 스모크 테스트 성공!');
    ws.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ 스모크 테스트 실패:', error.message);
    if (ws) ws.close();
    process.exit(1);
  }
}

main();

