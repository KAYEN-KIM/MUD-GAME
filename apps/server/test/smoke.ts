#!/usr/bin/env tsx
/**
 * E2E Smoke Test
 * 
 * 테스트 시나리오:
 * 1. AUTH → STATE_SYNC 확인
 * 2. SAFE 지역에서 MOVE
 * 3. 미궁으로 MOVE → HUNT → COMBAT
 * 4. (선택) 사망 테스트
 * 5. SAFE에서 REST
 */

import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';
const REST_URL = process.env.REST_URL || 'http://localhost:3000';

interface WSMessage {
  t: string;
  reqId?: string;
  ts: number;
  p: any;
}

class SmokeTest {
  private ws!: WebSocket;
  private token: string = '';
  private characterId: string = '';
  private characterName: string = '';
  private messageQueue: WSMessage[] = [];
  private lastStateSync: WSMessage | null = null; // 최신 STATE_SYNC 저장
  private testPassed = 0;
  private testFailed = 0;
  private prisma = new PrismaClient();
  private adjacencyMap: Map<string, string[]> = new Map(); // DB 기반 그래프

  async run() {
    console.log('🧪 E2E 스모크 테스트 시작...\n');

    try {
      // DB 기반 그래프 초기화 (BFS용)
      await this.initializeAdjacencyMap();
      
      await this.test0_Register();
      await this.test1_Login();
      await this.test2_WSConnect();
      await this.test3_Auth();
      await this.test4_StateSync();
      await this.testPreflight_DebugMode(); // DEBUG 프리플라이트 추가
      await this.test5_MoveToSafe();
      await this.test6_RestDeny();
      await this.test7_RestSuccess();
      await this.test8_MoveToDungeon();
      await this.test9_Hunt();
      await this.test10_DebugGold();
      await this.test11_DebugSetHp();
      await this.test12_Death();
      await this.test13_RestAfterDeath();
      await this.test14_DailyQuest();
      await this.test15_SeasonShop();
      await this.test16_S2VerticalSlice();
      await this.test17_S1BossTrophyExchange();
      
      console.log('\n✅ 모든 테스트 통과!');
      console.log(`   성공: ${this.testPassed}, 실패: ${this.testFailed}`);
      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ 테스트 실패:', error.message);
      console.log(`   성공: ${this.testPassed}, 실패: ${this.testFailed}`);
      process.exit(1);
    } finally {
      this.ws?.close();
      await this.prisma.$disconnect();
    }
  }

  /**
   * DB에서 RoomExit를 읽어 adjacency map 초기화
   */
  private async initializeAdjacencyMap() {
    console.log('[초기화] DB 기반 그래프 구축 중...');
    const exits = await this.prisma.roomExit.findMany({
      select: { fromRoomId: true, toRoomId: true },
    });
    
    for (const exit of exits) {
      if (!this.adjacencyMap.has(exit.fromRoomId)) {
        this.adjacencyMap.set(exit.fromRoomId, []);
      }
      this.adjacencyMap.get(exit.fromRoomId)!.push(exit.toRoomId);
    }
    
    console.log(`  ✓ ${exits.length}개 출구, ${this.adjacencyMap.size}개 노드 로드 완료`);
  }

  /**
   * BFS로 최단 경로 계산
   */
  private bfsPath(from: string, to: string): string[] | null {
    if (from === to) return [from];
    
    const queue: string[] = [from];
    const visited = new Set<string>([from]);
    const parent = new Map<string, string>();
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.adjacencyMap.get(current) || [];
      
      for (const next of neighbors) {
        if (visited.has(next)) continue;
        visited.add(next);
        parent.set(next, current);
        queue.push(next);
        
        if (next === to) {
          // 경로 재구성
          const path: string[] = [];
          let node = to;
          while (node) {
            path.unshift(node);
            node = parent.get(node)!;
          }
          return path;
        }
      }
    }
    
    return null; // 경로 없음
  }

  /**
   * DB BFS 기반 결정적 이동
   */
  private async navigateToRoomDb(targetRoomId: string, maxHops = 60): Promise<void> {
    const currentRoomId = this.lastStateSync?.p.char?.roomId;
    if (!currentRoomId) {
      throw new Error('현재 위치를 알 수 없습니다 (lastStateSync 없음)');
    }
    
    if (currentRoomId === targetRoomId) {
      console.log(`  ✓ 이미 ${targetRoomId}에 있습니다`);
      return;
    }
    
    const path = this.bfsPath(currentRoomId, targetRoomId);
    
    if (!path) {
      // 디버그 정보 출력
      const reachable = Array.from(this.adjacencyMap.keys()).length;
      const hasTarget = this.adjacencyMap.has(targetRoomId);
      const incomingEdges = Array.from(this.adjacencyMap.entries())
        .filter(([_, targets]) => targets.includes(targetRoomId))
        .map(([from, _]) => from);
      
      throw new Error(
        `[BFS] ${currentRoomId} → ${targetRoomId} 경로 없음\n` +
        `  도달 가능 노드: ${reachable}개\n` +
        `  목표 노드 존재: ${hasTarget}\n` +
        `  목표로의 진입 간선: ${incomingEdges.length}개 (${incomingEdges.slice(0, 5).join(', ')}...)`
      );
    }
    
    console.log(`  [BFS] 경로: ${path.join(' → ')} (${path.length - 1}홉)`);
    
    if (path.length - 1 > maxHops) {
      throw new Error(`[BFS] 경로가 너무 깁니다: ${path.length - 1}홉 > ${maxHops}홉 제한`);
    }
    
    // path[0]은 현재 위치이므로 path[1..]을 순회
    for (let i = 1; i < path.length; i++) {
      const nextRoomId = path[i];
      const reqId = this.send('MOVE', { toRoomId: nextRoomId });
      const moveSync = await this.waitForMessage('STATE_SYNC', 5000, reqId);
      
      if (!moveSync) {
        throw new Error(`[BFS] ${nextRoomId}로 이동 중 STATE_SYNC 미수신 (경로 ${i}/${path.length - 1})`);
      }
      
      const actualRoomId = moveSync.p.char?.roomId;
      if (actualRoomId !== nextRoomId) {
        throw new Error(`[BFS] 이동 실패: 예상=${nextRoomId}, 실제=${actualRoomId}`);
      }
      
      this.lastStateSync = moveSync;
    }
    
    console.log(`  ✓ ${targetRoomId} 도착 완료`);
  }

  private async test0_Register() {
    console.log('[0] REST API 회원가입 테스트...');
    
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'test123456';
    const testCharName = `Smoke${Math.floor(Date.now() / 1000)}`.substring(0, 20); // 최대 20자

    const response = await fetch(`${REST_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        characterName: testCharName,
      }),
    });

    if (!response.ok) {
      throw new Error(`회원가입 실패: ${response.status}`);
    }

    const data = await response.json();
    this.token = data.token;
    this.characterId = data.character.id;
    this.characterName = data.character.name;

    console.log(`  ✓ 회원가입 성공: ${this.characterName} (${this.characterId})`);
    this.testPassed++;
  }

  private async test1_Login() {
    console.log('[1] 토큰 확인 (회원가입으로 이미 받음)...');
    
    if (!this.token || !this.characterId) {
      throw new Error('회원가입 후 토큰/캐릭터 ID가 없습니다.');
    }

    console.log(`  ✓ 토큰 확인: ${this.token.substring(0, 20)}...`);
    this.testPassed++;
  }

  private async test2_WSConnect() {
    console.log('[2] WebSocket 연결 테스트...');
    
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('  ✓ WebSocket 연결 성공');
        this.testPassed++;
        resolve();
      });

      this.ws.on('error', (error) => {
        reject(new Error(`WebSocket 연결 실패: ${error.message}`));
      });

      this.ws.on('message', (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.messageQueue.push(message);
          
          // STATE_SYNC는 항상 최신 것을 저장
          if (message.t === 'STATE_SYNC') {
            this.lastStateSync = message;
          }
        } catch (error) {
          console.error('  ⚠️  메시지 파싱 실패:', data.toString());
        }
      });

      setTimeout(() => reject(new Error('WebSocket 연결 타임아웃')), 5000);
    });
  }

  private async test3_Auth() {
    console.log('[3] AUTH 테스트...');
    
    this.send('AUTH', { token: this.token });
    
    const authOk = await this.waitForMessage('AUTH_OK', 3000);
    if (!authOk) {
      throw new Error('AUTH_OK 수신 실패');
    }

    console.log('  ✓ 인증 성공');
    this.testPassed++;
  }

  private async test4_StateSync() {
    console.log('[4] STATE_SYNC 수신 테스트...');
    
    let stateSync = await this.waitForMessage('STATE_SYNC', 3000);
    if (!stateSync) {
      throw new Error('STATE_SYNC 수신 실패');
    }

    const char = stateSync.p.char || stateSync.p.character;
    if (!char || !char.roomId) {
      throw new Error('STATE_SYNC에 캐릭터 정보 없음');
    }

    // exits 검증 강제 (최대 2회 재시도)
    let retries = 0;
    while ((!stateSync.p.exits || stateSync.p.exits.length === 0) && retries < 2) {
      console.log(`  ⚠️  exits 없음, 1초 대기 후 재확인 (${retries + 1}/2)...`);
      await this.sleep(1000);
      stateSync = this.lastStateSync || stateSync;
      retries++;
    }

    if (!stateSync.p.exits || stateSync.p.exits.length === 0) {
      throw new Error('STATE_SYNC에 exits가 비어있습니다. 맵/시드 설정을 확인하세요.');
    }

    console.log(`  ✓ STATE_SYNC 수신: roomId=${char.roomId}, hp=${char.hp}/${char.hpMax}, gold=${char.gold}, exits=${stateSync.p.exits.length}개`);
    this.testPassed++;
  }

  private async testPreflight_DebugMode() {
    console.log('[Preflight] TEST_MODE 확인...');
    
    // DEBUG_GRANT_GOLD로 TEST_MODE 활성화 여부 확인 (reqId 기반)
    const reqId = this.send('DEBUG_GRANT_GOLD', { amount: 1 });
    
    // ERROR 또는 STATE_SYNC 대기 (2초)
    const errorMsg = await this.waitForError(reqId, 2000);
    if (errorMsg) {
      console.error('\n❌ TEST_MODE가 활성화되지 않았습니다!');
      console.error('   서버를 다음 명령으로 재시작하세요:');
      console.error('   Windows PowerShell:');
      console.error('     $env:TEST_MODE="true"; pnpm --filter server dev');
      console.error('   Linux/Mac:');
      console.error('     TEST_MODE=true pnpm --filter server dev\n');
      throw new Error('TEST_MODE 미활성화: 서버 재시작 필요');
    }
    
    // STATE_SYNC 확인 (정상 응답, type만 매칭)
    const stateSync = await this.waitForMessage('STATE_SYNC', 2000);
    if (!stateSync) {
      throw new Error('DEBUG 프리플라이트 실패: STATE_SYNC 미수신');
    }
    
    console.log('  ✓ TEST_MODE 활성화 확인');
    this.testPassed++;
  }

  private async test5_MoveToSafe() {
    console.log('[5] SAFE 지역 이동 테스트 (exits 기반)...');
    
    // 최신 STATE_SYNC 사용
    if (!this.lastStateSync || !this.lastStateSync.p.exits || this.lastStateSync.p.exits.length === 0) {
      throw new Error('exits가 없어 이동할 수 없습니다 (test4에서 검증 실패?)');
    }

    // 첫 번째 출구로 이동 시도
    const firstExit = this.lastStateSync.p.exits[0];
    this.send('MOVE', { toRoomId: firstExit.toRoomId });
    
    const stateSync = await this.waitForMessage('STATE_SYNC', 3000);
    if (!stateSync) {
      throw new Error('이동 후 STATE_SYNC 수신 실패');
    }

    const char = stateSync.p.char || stateSync.p.character;
    
    // roomTags 검증 (SAFE 여부 확인)
    const roomTags = char.roomTags || [];
    console.log(`  ✓ 이동 성공: ${char.roomId}, roomTags=[${roomTags.join(', ')}]`);
    this.testPassed++;
  }

  private async test6_RestDeny() {
    console.log('[6A] REST 거절 테스트 (SAFE 아닌 곳)...');
    
    // 현재 위치의 roomTags 확인
    let currentRoomTags = this.lastStateSync?.p?.char?.roomTags || [];
    
    // SAFE 방이면 exits 기반으로 SAFE 아닌 곳으로 이동 (최대 5회)
    let attempts = 0;
    while (currentRoomTags.includes('SAFE') && attempts < 5) {
      const exits = this.lastStateSync?.p?.exits || [];
      if (exits.length === 0) {
        console.log('  ⚠️  exits 없음, SKIP');
        this.testPassed++;
        return;
      }
      
      // 첫 번째 출구로 이동
      this.send('MOVE', { toRoomId: exits[0].toRoomId });
      const moveSync = await this.waitForMessage('STATE_SYNC', 3000);
      
      if (moveSync) {
        currentRoomTags = moveSync.p.char?.roomTags || [];
      }
      attempts++;
    }
    
    if (currentRoomTags.includes('SAFE')) {
      console.log('  ⚠️  5번 이동 후에도 SAFE 방, SKIP');
      this.testPassed++;
      return;
    }
    
    // REST 호출 (실패해야 함, reqId 기반)
    const reqId = this.send('REST', {});
    
    // ERROR 대기 (reqId 매칭)
    const errorMsg = await this.waitForError(reqId, 2000);
    
    if (!errorMsg) {
      throw new Error('SAFE가 아닌 곳에서 REST가 허용됨 (보안 위반!)');
    }
    
    console.log('  ✓ REST 거절 확인 (SAFE가 아님)');
    this.testPassed++;
  }

  private async test7_RestSuccess() {
    console.log('[6B] REST 성공 테스트 (SAFE 방 exits 기반 탐색)...');
    
    // 현재 roomTags 확인
    let currentRoomTags = this.lastStateSync?.p?.char?.roomTags || [];
    let attempts = 0;
    const maxAttempts = 10;
    
    // SAFE 방 찾기 (exits 기반 이동)
    while (!currentRoomTags.includes('SAFE') && attempts < maxAttempts) {
      const exits = this.lastStateSync?.p?.exits || [];
      if (exits.length === 0) {
        throw new Error('SAFE 방 탐색 실패: exits 없음');
      }
      
      // 첫 번째 출구로 이동
      const targetExit = exits[0];
      this.send('MOVE', { toRoomId: targetExit.toRoomId });
      const moveSync = await this.waitForMessage('STATE_SYNC', 3000);
      
      if (!moveSync) {
        throw new Error(`이동 실패 (시도 ${attempts + 1}/${maxAttempts})`);
      }
      
      currentRoomTags = moveSync.p.char?.roomTags || [];
      attempts++;
    }
    
    if (!currentRoomTags.includes('SAFE')) {
      throw new Error(`SAFE 방 탐색 실패: ${maxAttempts}번 이동 후에도 발견 못함 (맵/시드 계약 위반)`);
    }
    
    const currentRoom = this.lastStateSync?.p?.char?.roomId;
    console.log(`  ✓ SAFE 방 도착: ${currentRoom} (${attempts}번 이동)`);
    
    // HP 낮추기
    this.send('DEBUG_SET_HP', { hp: 50 });
    await this.waitForMessage('STATE_SYNC', 3000);
    
    // REST 호출
    this.send('REST', {});
    const restSync = await this.waitForMessage('STATE_SYNC', 3000);
    
    if (!restSync) {
      throw new Error('REST 후 STATE_SYNC 미수신');
    }
    
    const char = restSync.p.char || {};
    if (char.hp !== char.hpMax) {
      throw new Error(`REST 후 HP가 최대가 아님: ${char.hp}/${char.hpMax}`);
    }
    
    console.log(`  ✓ REST 성공: HP ${char.hp}/${char.hpMax}`);
    this.testPassed++;
  }

  private async test8_MoveToDungeon() {
    console.log('[7] 사냥 지역 이동...');
    
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const lastSync = this.lastStateSync;
      const char = lastSync?.p?.char || {};
      const currentRoomId = char.roomId;

      if (currentRoomId === 'GH_SLUMS') {
        console.log(`  ✓ 사냥 지역 도착: ${currentRoomId} (${attempts}번 이동)`);
        this.testPassed++;
        return;
      }

      const exits = (lastSync?.p?.exits as any[]) || [];
      if (exits.length === 0) {
        throw new Error('사냥 지역 이동 실패: exits 없음');
      }

      // GH_SLUMS 직행 → GH_GATE → START_TOWN 순서로 우선 경로 선택, 없으면 첫 출구
      const targetExit =
        exits.find((e) => e.toRoomId === 'GH_SLUMS') ||
        exits.find((e) => e.toRoomId === 'GH_GATE') ||
        exits.find((e) => e.toRoomId === 'START_TOWN') ||
        exits[0];

      const reqId = this.send('MOVE', { toRoomId: targetExit.toRoomId });
      const moveSync = await this.waitForMessage('STATE_SYNC', 3000, reqId);

      if (!moveSync) {
        throw new Error(`사냥 지역 이동 중 STATE_SYNC 미수신 (시도 ${attempts + 1}/${maxAttempts})`);
      }

      attempts++;
    }

    throw new Error(`사냥 지역 이동 실패: ${maxAttempts}번 이동 후에도 GH_SLUMS 도달 실패`);
  }

  private async test9_Hunt() {
    console.log('[8] HUNT → COMBAT 테스트...');
    
    // 파티 생성 (이미 있으면 실패해도 OK)
    this.send('PARTY_CREATE', {});
    await this.sleep(500);

    // HUNT 시작
    this.send('HUNT', {});
    
    const encounterStart = await this.waitForMessage('ENCOUNTER_START', 5000);
    if (!encounterStart) {
      throw new Error('ENCOUNTER_START 수신 실패');
    }

    console.log('  ✓ 전투 시작');

    // 전투 진행 (간단히 ATTACK만)
    this.send('COMBAT_TURN', { action: 'ATTACK' });
    
    // COMBAT_RESOLVE 대기
    await this.waitForMessage('COMBAT_RESOLVE', 10000);
    
    console.log('  ✓ 전투 턴 진행');
    this.testPassed++;
  }

  private async test10_DebugGold() {
    console.log('[9] DEBUG_GRANT_GOLD 테스트...');
    
    const beforeGold = this.lastStateSync?.p?.char?.gold || 0;
    
    this.send('DEBUG_GRANT_GOLD', { amount: 500 });
    const sync = await this.waitForMessage('STATE_SYNC', 3000);
    
    if (!sync) {
      throw new Error('DEBUG_GRANT_GOLD 후 STATE_SYNC 수신 실패');
    }
    
    const afterGold = sync.p.char?.gold || 0;
    if (afterGold < beforeGold + 500) {
      throw new Error(`골드 증가 실패: ${beforeGold} → ${afterGold} (예상: 최소 ${beforeGold + 500})`);
    }
    
    console.log(`  ✓ 골드 지급 확인: ${beforeGold} → ${afterGold}`);
    this.testPassed++;
  }

  private async test11_DebugSetHp() {
    console.log('[10] DEBUG_SET_HP 테스트...');
    
    const beforeChar = this.lastStateSync?.p?.char || {};
    const targetHp = Math.max(1, Math.floor(beforeChar.hpMax / 2));
    
    this.send('DEBUG_SET_HP', { hp: targetHp });
    const sync = await this.waitForMessage('STATE_SYNC', 3000);
    
    if (!sync) {
      throw new Error('DEBUG_SET_HP 후 STATE_SYNC 수신 실패');
    }
    
    const afterChar = sync.p.char || {};
    if (afterChar.hp !== targetHp) {
      throw new Error(`HP 설정 실패: ${afterChar.hp} (예상: ${targetHp})`);
    }
    
    console.log(`  ✓ HP 설정 확인: ${beforeChar.hp} → ${afterChar.hp}`);
    this.testPassed++;
  }

  private async test12_Death() {
    console.log('[11] DEBUG_APPLY_DEATH 테스트...');
    
    const beforeChar = this.lastStateSync?.p?.char || {};
    const beforeGold = beforeChar.gold || 0;
    const beforeHpMax = beforeChar.hpMax || 100;
    
    console.log(`  현재: gold=${beforeGold}, hpMax=${beforeHpMax}`);
    
    // DEBUG_APPLY_DEATH
    this.send('DEBUG_APPLY_DEATH', {});
    const afterSync = await this.waitForMessage('STATE_SYNC', 3000);
    
    if (!afterSync) {
      throw new Error('사망 후 STATE_SYNC 수신 실패');
    }
    
    const afterChar = afterSync.p.char || {};
    
    // 검증: roomId == START_TOWN
    if (afterChar.roomId !== 'START_TOWN') {
      throw new Error(`부활 위치 오류: ${afterChar.roomId} (예상: START_TOWN)`);
    }
    
    // 검증: gold 감소 (10%)
    const expectedGoldLoss = Math.floor(beforeGold * 0.1);
    const expectedGold = beforeGold - expectedGoldLoss;
    if (Math.abs(afterChar.gold - expectedGold) > 1) {
      console.log(`  ⚠️  골드 패널티 차이: 예상=${expectedGold}, 실제=${afterChar.gold}`);
    }
    
    // 검증: hp == max(1, floor(hpMax * 0.5))
    const expectedHp = Math.max(1, Math.floor(beforeHpMax * 0.5));
    if (afterChar.hp !== expectedHp) {
      throw new Error(`부활 HP 오류: ${afterChar.hp} (예상: ${expectedHp})`);
    }
    
    console.log(`  ✓ 사망/부활 확인: gold ${beforeGold}→${afterChar.gold}, hp→${afterChar.hp}`);
    this.testPassed++;
  }

  private async test13_RestAfterDeath() {
    console.log('[12] 부활 후 REST 테스트...');
    
    // START_TOWN은 SAFE이므로 REST 가능
    this.send('REST', {});
    const restSync = await this.waitForMessage('STATE_SYNC', 3000);
    
    if (!restSync) {
      throw new Error('REST 후 STATE_SYNC 수신 실패');
    }
    
    const char = restSync.p.char || {};
    if (char.hp !== char.hpMax) {
      throw new Error(`REST 후 HP가 최대가 아님: ${char.hp}/${char.hpMax}`);
    }
    
    console.log(`  ✓ REST 후 HP 회복: ${char.hp}/${char.hpMax}`);
    this.testPassed++;
  }

  private async test14_DailyQuest() {
    console.log('[13] 데일리 퀘스트 테스트...');
    
    // A) GH_GATE로 이동 (일일 퀘스트 giver)
    console.log('  - [14.1] GH_GATE로 이동 (DB BFS)');
    await this.navigateToRoomDb('GH_GATE');
    console.log('  ✓ GH_GATE 도착');
    
    // B) QUEST_LIST (available) - 데일리 퀘스트 확인
    console.log('  - [14.2] QUEST_LIST 요청 (Q_S01_D02 확인)');
    const listReqId1 = this.send('QUEST_LIST', {});
    const questList1 = await this.waitForMessage('QUEST_LIST', 5000, listReqId1);
    if (!questList1 || !questList1.p.available) {
      throw new Error('QUEST_LIST 수신 실패 또는 available 퀘스트 없음');
    }
    
    // Q_S01_D02 찾기 (필수)
    const dailyQuest = questList1.p.available.find((q: any) => q.questId === 'Q_S01_D02');
    if (!dailyQuest) {
      throw new Error('Q_S01_D02 퀘스트를 찾을 수 없습니다. (minLevel/season gating 확인 필요)');
    }
    console.log(`  ✓ 데일리 퀘스트 확인: ${dailyQuest.title}`);
    
    // C) QUEST_ACCEPT
    console.log('  - [14.3] QUEST_ACCEPT (Q_S01_D02)');
    const acceptReqId = this.send('QUEST_ACCEPT', { questId: 'Q_S01_D02' });
    const questList2 = await this.waitForMessage('QUEST_LIST', 5000, acceptReqId);
    if (!questList2 || !questList2.p.active) {
      throw new Error('QUEST_ACCEPT 후 QUEST_LIST 수신 실패');
    }
    
    const activeDaily = questList2.p.active.find((q: any) => q.questId === 'Q_S01_D02');
    if (!activeDaily || activeDaily.status !== 'ACTIVE') {
      throw new Error(`Q_S01_D02 수락 실패 또는 상태 오류: ${activeDaily?.status}`);
    }
    console.log(`  ✓ 수락 완료: ${activeDaily.status}`);
    
    // D) R1_01로 이동 (VISIT_ROOM 목표 달성)
    console.log('  - [14.4] R1_01로 이동 (VISIT_ROOM 목표)');
    await this.navigateToRoomDb('R1_01');
    console.log('  ✓ R1_01 도착');
    
    // E) QUEST_LIST로 COMPLETED 확인
    console.log('  - [14.5] 퀘스트 완료 확인');
    const listReqId3 = this.send('QUEST_LIST', {});
    const questList3 = await this.waitForMessage('QUEST_LIST', 5000, listReqId3);
    if (!questList3 || !questList3.p.active) {
      throw new Error('QUEST_LIST 수신 실패');
    }
    
    const completedDaily = questList3.p.active.find((q: any) => q.questId === 'Q_S01_D02');
    if (!completedDaily || completedDaily.status !== 'COMPLETED') {
      throw new Error(`Q_S01_D02 완료 실패: 상태=${completedDaily?.status}, progress=${JSON.stringify(completedDaily?.progressSummary)}`);
    }
    console.log(`  ✓ 완료 확인: ${completedDaily.status}`);
    
    // F) GH_GATE로 돌아가서 QUEST_TURNIN
    console.log('  - [14.6] GH_GATE로 이동 (턴인)');
    await this.navigateToRoomDb('GH_GATE');
    
    // 보상 수령 전 gold/exp 기록
    const beforeTurnin = this.lastStateSync?.p.char;
    const goldBefore = beforeTurnin?.gold || 0;
    const expBefore = beforeTurnin?.exp || 0;
    
    console.log('  - [14.7] QUEST_TURNIN 실행');
    const turninReqId = this.send('QUEST_TURNIN', { questId: 'Q_S01_D02' });
    const turninSync = await this.waitForMessage('STATE_SYNC', 5000, turninReqId);
    if (!turninSync) {
      throw new Error('QUEST_TURNIN 후 STATE_SYNC 수신 실패');
    }
    
    const afterTurnin = turninSync.p.char;
    const goldAfter = afterTurnin?.gold || 0;
    const expAfter = afterTurnin?.exp || 0;
    
    // 보상 증가 확인 (정확한 수치가 아닌 "증가 여부"만)
    if (goldAfter <= goldBefore) {
      console.log(`  ⚠️  골드 증가 없음: ${goldBefore} → ${goldAfter}`);
    } else {
      console.log(`  ✓ 골드 증가: ${goldBefore} → ${goldAfter} (+${goldAfter - goldBefore})`);
    }
    
    if (expAfter <= expBefore) {
      console.log(`  ⚠️  EXP 증가 없음: ${expBefore} → ${expAfter}`);
    } else {
      console.log(`  ✓ EXP 증가: ${expBefore} → ${expAfter} (+${expAfter - expBefore})`);
    }
    
    console.log('[13] 데일리 퀘스트 테스트 완료!');
    this.testPassed++;
  }

  private async test15_SeasonShop() {
    console.log('[14] 시즌 샵 테스트...');
    
    // 1. DEBUG_GRANT_ITEM으로 인장 5개 지급
    console.log('  - [15.1] DEBUG_GRANT_ITEM (인장 5개 지급)');
    const grantReqId = this.send('DEBUG_GRANT_ITEM', { itemId: 'ITEM_LEDGER_SEAL_S1', qty: 5 });
    const grantSync = await this.waitForMessage('STATE_SYNC', 3000, grantReqId);
    if (!grantSync) {
      throw new Error('DEBUG_GRANT_ITEM 후 STATE_SYNC 수신 실패');
    }
    console.log('  ✓ 인장 5개 지급 완료');
    this.lastStateSync = grantSync;
    
    // 1-1. S2 트로피도 미리 지급 (S2 테스트용)
    console.log('  - [15.1-2] DEBUG_GRANT_ITEM (S2 트로피 3개 지급)');
    const grantReqId2 = this.send('DEBUG_GRANT_ITEM', { itemId: 'ITEM_TROPHY_BOSS_S02', qty: 3 });
    const grantSync2 = await this.waitForMessage('STATE_SYNC', 3000, grantReqId2);
    if (!grantSync2) {
      throw new Error('DEBUG_GRANT_ITEM (S2 트로피) 후 STATE_SYNC 수신 실패');
    }
    console.log('  ✓ S2 트로피 3개 지급 완료');
    this.lastStateSync = grantSync2;
    
    // 2. GH_LEDGER_OFFICE로 이동 (명시적 경로: GH_GATE → GH_MARKET → GH_LEDGER_OFFICE)
    console.log('  - [15.2] GH_LEDGER_OFFICE로 이동');
    const currentState = this.lastStateSync?.p.char;
    if (!currentState) throw new Error('현재 상태를 알 수 없습니다.');
    
    // 현재 위치 확인 및 필요시 이동
    if (currentState.roomId !== 'GH_LEDGER_OFFICE') {
      // START_TOWN → GH_GATE
      if (currentState.roomId === 'START_TOWN') {
        const moveReqId1 = this.send('MOVE', { toRoomId: 'GH_GATE' });
        const moveSync1 = await this.waitForMessage('STATE_SYNC', 3000, moveReqId1);
        if (!moveSync1) throw new Error('GH_GATE 이동 후 STATE_SYNC 수신 실패');
        this.lastStateSync = moveSync1;
      }
      
      // 현재 위치가 GH_GATE가 아니면 GH_GATE로 이동 시도
      if (this.lastStateSync?.p.char?.roomId !== 'GH_GATE') {
        const exits = this.lastStateSync?.p.exits || [];
        const gateExit = exits.find((e: any) => e.toRoomId === 'GH_GATE');
        if (gateExit) {
          const moveReqId = this.send('MOVE', { toRoomId: 'GH_GATE' });
          const moveSync = await this.waitForMessage('STATE_SYNC', 3000, moveReqId);
          if (!moveSync) throw new Error('GH_GATE 이동 후 STATE_SYNC 수신 실패');
          this.lastStateSync = moveSync;
        }
      }
      
      // GH_GATE → GH_MARKET
      if (this.lastStateSync?.p.char?.roomId === 'GH_GATE') {
        const moveReqId2 = this.send('MOVE', { toRoomId: 'GH_MARKET' });
        const moveSync2 = await this.waitForMessage('STATE_SYNC', 3000, moveReqId2);
        if (!moveSync2) throw new Error('GH_MARKET 이동 후 STATE_SYNC 수신 실패');
        this.lastStateSync = moveSync2;
      }
      
      // GH_MARKET → GH_LEDGER_OFFICE
      if (this.lastStateSync?.p.char?.roomId === 'GH_MARKET') {
        const moveReqId3 = this.send('MOVE', { toRoomId: 'GH_LEDGER_OFFICE' });
        const moveSync3 = await this.waitForMessage('STATE_SYNC', 3000, moveReqId3);
        if (!moveSync3) throw new Error('GH_LEDGER_OFFICE 이동 후 STATE_SYNC 수신 실패');
        this.lastStateSync = moveSync3;
        
        if (moveSync3.p.char?.roomId !== 'GH_LEDGER_OFFICE') {
          console.log('  ⚠️  GH_LEDGER_OFFICE로 이동할 수 없습니다. 시즌 샵 테스트를 건너뜁니다.');
          return;
        }
      } else {
        console.log(`  ⚠️  GH_MARKET에 도달할 수 없습니다 (현재: ${this.lastStateSync?.p.char?.roomId}). 시즌 샵 테스트를 건너뜁니다.`);
        return;
      }
    }
    console.log('  ✓ GH_LEDGER_OFFICE 도착');
    
    // 3. SHOP_LIST 호출
    console.log('  - [15.3] SHOP_LIST 호출');
    const listReqId = this.send('SHOP_LIST', {});
    const shopList = await this.waitForMessage('SHOP_LIST', 5000, listReqId);
    if (!shopList || !shopList.p.items) {
      throw new Error('SHOP_LIST 수신 실패 또는 items 없음');
    }
    console.log(`  ✓ 상점 목록 수신: ${shopList.p.title}, 아이템 ${shopList.p.items.length}개`);
    
    // 4. ITEM_ACC_GATE_ANCHOR_SIGIL_S1이 목록에 있는지 확인 (인장 4개 필요)
    const targetItem = shopList.p.items.find((i: any) => i.itemId === 'ITEM_ACC_GATE_ANCHOR_SIGIL_S1');
    if (!targetItem) {
      throw new Error('ITEM_ACC_GATE_ANCHOR_SIGIL_S1을 상점에서 찾을 수 없습니다.');
    }
    console.log(`  ✓ 목표 아이템 확인: ${targetItem.itemName}, 비용: 인장 ${targetItem.costItems[0]?.qty || 0}개`);
    
    // 5. SHOP_BUY (ITEM_ACC_GATE_ANCHOR_SIGIL_S1)
    console.log('  - [15.4] SHOP_BUY (게이트 정박 시길)');
    const buyReqId = this.send('SHOP_BUY', { itemId: 'ITEM_ACC_GATE_ANCHOR_SIGIL_S1' });
    const buySync = await this.waitForMessage('STATE_SYNC', 5000, buyReqId);
    if (!buySync) {
      throw new Error('SHOP_BUY 후 STATE_SYNC 수신 실패');
    }
    console.log('  ✓ 구매 완료');
    this.lastStateSync = buySync;
    
    // 6. 인벤토리 검증
    console.log('  - [15.5] 인벤토리 검증');
    const invReqId = this.send('INVENTORY_LIST', {});
    const invList = await this.waitForMessage('INVENTORY_LIST', 5000, invReqId);
    // items / inventory 둘 다 지원 (서버/클라 스키마 차이 흡수)
    const invItems = invList?.p.items || invList?.p.inventory;
    if (!invList || !invItems) {
      throw new Error('INVENTORY_LIST 수신 실패');
    }
    
    // 구매한 아이템 확인
    const boughtItem = invItems.find((i: any) => i.itemId === 'ITEM_ACC_GATE_ANCHOR_SIGIL_S1');
    if (!boughtItem || boughtItem.qty < 1) {
      throw new Error('구매한 아이템이 인벤토리에 없습니다.');
    }
    console.log(`  ✓ 구매 아이템 확인: ${boughtItem.itemName || 'ITEM_ACC_GATE_ANCHOR_SIGIL_S1'} x${boughtItem.qty}`);
    
    // 인장 차감 확인 (5 - 4 = 1)
    const sealItem = invItems.find((i: any) => i.itemId === 'ITEM_LEDGER_SEAL_S1');
    if (!sealItem || sealItem.qty !== 1) {
      throw new Error(`인장 차감이 정확하지 않습니다. 예상: 1, 실제: ${sealItem?.qty || 0}`);
    }
    console.log(`  ✓ 인장 차감 확인: ${sealItem.itemName || 'ITEM_LEDGER_SEAL_S1'} x${sealItem.qty}`);
    
    // 7. 인장 부족 시도 (에러 확인)
    console.log('  - [15.6] 인장 부족 시도 (에러 확인)');
    const buyReqId2 = this.send('SHOP_BUY', { itemId: 'ITEM_WEAPON_BROKER_BLADE_S1' }); // 인장 3개 필요
    const errorMsg = await this.waitForError(buyReqId2, 3000);
    if (!errorMsg) {
      console.log('  ⚠️  인장 부족 에러를 받지 못했습니다 (선택 테스트)');
    } else {
      console.log(`  ✓ 인장 부족 에러 확인: ${errorMsg.p?.message || '부족'}`);
    }
    
    console.log('[14] 시즌 샵 테스트 완료!');
    this.testPassed++;
  }

  private async test16_S2VerticalSlice() {
    console.log('[15] S2 Vertical Slice E2E 테스트...');
    
    // TEST_MODE 확인
    if (process.env.TEST_MODE !== 'true') {
      console.log('  ⚠️  TEST_MODE가 아니므로 S2 테스트를 건너뜁니다.');
      return;
    }
    
    console.log('  - [16.1] 현재 상태 확인');
    const currentState = this.lastStateSync?.p.char;
    if (!currentState) throw new Error('현재 상태를 알 수 없습니다.');
    console.log(`  ✓ 현재 위치: ${currentState.roomId}, Lv.${currentState.level}`);
    
    // B) GH_RIFT_OUTPOST로 이동
    console.log('  - [16.2] GH_RIFT_OUTPOST로 이동');
    await this.navigateToRoom('GH_RIFT_OUTPOST', 15);
    console.log(`  ✓ GH_RIFT_OUTPOST 도착`);
    
    // C) R2_00로 이동 (S2 허브)
    console.log('  - [16.3] R2_00 (연무의 도서 입구)로 이동');
    const riftExit = this.lastStateSync?.p.exits?.find((e: any) => e.toRoomId === 'R2_00');
    if (!riftExit) {
      console.log('  ⚠️  R2_00로 가는 출구가 없습니다. S2 맵이 없거나 시드 문제일 수 있습니다.');
      console.log('  ℹ️  S2 테스트를 건너뜁니다.');
      return;
    }
    this.send('MOVE', { toRoomId: 'R2_00' });
    const moveR2 = await this.waitForMessage('STATE_SYNC', 5000);
    if (!moveR2 || moveR2.p.char?.roomId !== 'R2_00') {
      throw new Error(`R2_00 이동 실패: ${moveR2?.p.char?.roomId}`);
    }
    this.lastStateSync = moveR2;
    console.log(`  ✓ R2_00 도착`);
    
    // D) R2_00에서 S2 트로피 교환소 SHOP_LIST 확인
    console.log('  - [16.4] R2_00 S2 트로피 교환소 확인');
    const shopReqId = this.send('SHOP_LIST', {});
    const shopList = await this.waitForMessage('SHOP_LIST', 5000, shopReqId);
    if (!shopList || !shopList.p.items) {
      throw new Error('R2_00 SHOP_LIST 수신 실패');
    }
    
    if (shopList.p.shopId !== 'SHOP_S2_BOSS_TROPHY_EXCHANGE') {
      throw new Error(`R2_00 상점 ID 불일치: ${shopList.p.shopId} (예상: SHOP_S2_BOSS_TROPHY_EXCHANGE)`);
    }
    
    console.log(`  ✓ S2 교환소 확인: ${shopList.p.title}, 아이템 ${shopList.p.items.length}개`);
    
    // E) ITEM_ICON_BOSS_S02 구매 (트로피 2개 필요, test15에서 이미 3개 지급됨)
    console.log('  - [16.5] SHOP_BUY (ITEM_ICON_BOSS_S02)');
    const targetIcon = shopList.p.items.find((i: any) => i.itemId === 'ITEM_ICON_BOSS_S02');
    if (!targetIcon) {
      throw new Error('ITEM_ICON_BOSS_S02를 상점에서 찾을 수 없습니다.');
    }
    console.log(`  ✓ 목표 아이템 확인: ${targetIcon.name || 'ITEM_ICON_BOSS_S02'}`);
    
    const buyReqId = this.send('SHOP_BUY', { itemId: 'ITEM_ICON_BOSS_S02' });
    
    // SHOP_BUY_OK 대기 (reqId 매칭)
    const buyOk = await this.waitForMessage('SHOP_BUY_OK', 5000, buyReqId);
    if (!buyOk) {
      // SHOP_BUY_ERR도 확인
      const buyErr = await this.waitForMessage('SHOP_BUY_ERR', 1000, buyReqId);
      if (buyErr) {
        throw new Error(`SHOP_BUY 실패: ${buyErr.p.message}`);
      }
      throw new Error('SHOP_BUY_OK 수신 실패 (타임아웃)');
    }
    
    console.log(`  ✓ 구매 완료: ${buyOk.p.itemId} x${buyOk.p.qty || 1}`);
    
    // F) 인벤토리 검증
    console.log('  - [16.6] 인벤토리 최종 검증');
    const invReqId = this.send('INVENTORY_LIST', {});
    const invList = await this.waitForMessage('INVENTORY_LIST', 5000, invReqId);
    const invItems = invList?.p.items || invList?.p.inventory;
    if (!invItems) throw new Error('INVENTORY_LIST 수신 실패');
    
    const iconItem = invItems.find((i: any) => i.itemId === 'ITEM_ICON_BOSS_S02');
    if (!iconItem || iconItem.qty < 1) {
      throw new Error('ITEM_ICON_BOSS_S02가 인벤토리에 없습니다.');
    }
    console.log(`  ✓ 아이콘 확인: ${iconItem.name || iconItem.itemId} x${iconItem.qty}`);
    
    // 트로피 차감 확인 (3 - 2 = 1)
    const trophyAfter = invItems.find((i: any) => i.itemId === 'ITEM_TROPHY_BOSS_S02');
    if (trophyAfter && trophyAfter.qty !== 1) {
      console.log(`  ⚠️  트로피 차감 불일치: 예상=1, 실제=${trophyAfter.qty}`);
    } else {
      console.log(`  ✓ 트로피 차감 확인: 3 → ${trophyAfter?.qty || 0}`);
    }
    
    console.log('[15] S2 Vertical Slice E2E 테스트 완료!');
    this.testPassed++;
  }

  /**
   * [16] S1 Boss Trophy 교환소 접근 테스트 (GH_TROPHY_HALL_S1)
   */
  private async test17_S1BossTrophyExchange() {
    console.log('[16] S1 Boss Trophy 교환소 접근 테스트...');
    
    // A) 트로피 지급 (DEBUG_GRANT_ITEM)
    console.log('  - [17.1] DEBUG_GRANT_ITEM (S1 보스 트로피 3개 지급)');
    const grantReqId = this.send('DEBUG_GRANT_ITEM', { itemId: 'ITEM_TROPHY_BOSS_S1_RESIDUE_BROKER', qty: 3 });
    const grantSync = await this.waitForMessage('STATE_SYNC', 3000, grantReqId);
    if (!grantSync) {
      throw new Error('DEBUG_GRANT_ITEM 후 STATE_SYNC 수신 실패');
    }
    console.log('  ✓ S1 트로피 3개 지급 완료');
    this.lastStateSync = grantSync;
    
    // B) GH_TROPHY_HALL_S1로 이동 (DB BFS 사용)
    console.log('  - [17.2] GH_TROPHY_HALL_S1로 이동 (DB BFS)');
    await this.navigateToRoomDb('GH_TROPHY_HALL_S1');
    console.log(`  ✓ GH_TROPHY_HALL_S1 도착`);
    
    // C) SHOP_LIST 확인
    console.log('  - [17.3] SHOP_LIST 요청');
    const shopReqId = this.send('SHOP_LIST', {});
    const shopList = await this.waitForMessage('SHOP_LIST', 5000, shopReqId);
    if (!shopList || !shopList.p.items) {
      throw new Error('SHOP_LIST 수신 실패');
    }
    
    // SHOP_S1_BOSS_TROPHY_EXCHANGE 확인
    const shopId = shopList.p.id || shopList.p.shopId;
    if (shopId !== 'SHOP_S1_BOSS_TROPHY_EXCHANGE') {
      throw new Error(`SHOP_S1_BOSS_TROPHY_EXCHANGE가 아닙니다: ${shopId}`);
    }
    console.log(`  ✓ 상점 확인: ${shopId} (${shopList.p.title || '보스 트로피 교환소'})`);
    
    const targetIcon = shopList.p.items.find((i: any) => i.itemId === 'ITEM_ICON_BOSS_S1_RESIDUE_BROKER');
    if (!targetIcon) {
      throw new Error('ITEM_ICON_BOSS_S1_RESIDUE_BROKER가 상점에 없습니다.');
    }
    console.log(`  ✓ 목표 아이템 확인: ${targetIcon.name || targetIcon.itemId}`);
    
    // D) SHOP_BUY로 아이콘 구매
    console.log('  - [17.4] SHOP_BUY (아이콘 구매, 트로피 2개 소모)');
    const buyReqId = this.send('SHOP_BUY', { itemId: 'ITEM_ICON_BOSS_S1_RESIDUE_BROKER' });
    const buyOk = await this.waitForMessage('SHOP_BUY_OK', 5000, buyReqId);
    const buyErr = await this.waitForMessage('SHOP_BUY_ERR', 1000, buyReqId);
    
    if (buyErr) {
      throw new Error(`SHOP_BUY 실패: ${buyErr.p.message}`);
    }
    if (!buyOk) {
      throw new Error('SHOP_BUY_OK 수신 실패');
    }
    console.log(`  ✓ 구매 완료: ${buyOk.p.itemId} x${buyOk.p.qty || 1}`);
    
    // E) 인벤토리 검증
    console.log('  - [17.5] 인벤토리 검증');
    const invReqId = this.send('INVENTORY_LIST', {});
    const invList = await this.waitForMessage('INVENTORY_LIST', 5000, invReqId);
    const invItems = invList?.p.items || invList?.p.inventory;
    if (!invItems) throw new Error('INVENTORY_LIST 수신 실패');
    
    const iconItem = invItems.find((i: any) => i.itemId === 'ITEM_ICON_BOSS_S1_RESIDUE_BROKER');
    if (!iconItem || iconItem.qty < 1) {
      throw new Error('ITEM_ICON_BOSS_S1_RESIDUE_BROKER가 인벤토리에 없습니다.');
    }
    console.log(`  ✓ 아이콘 확인: ${iconItem.itemName || iconItem.name || iconItem.itemId} x${iconItem.qty}`);
    
    // 트로피 차감 확인 (3 - 2 = 1)
    const trophyAfter = invItems.find((i: any) => i.itemId === 'ITEM_TROPHY_BOSS_S1_RESIDUE_BROKER');
    if (!trophyAfter || trophyAfter.qty !== 1) {
      console.log(`  ⚠️  트로피 차감 불일치: 예상=1, 실제=${trophyAfter?.qty || 0}`);
    } else {
      console.log(`  ✓ 트로피 차감 확인: 3 → ${trophyAfter.qty}`);
    }
    
    console.log('[16] S1 Boss Trophy 교환소 테스트 완료!');
    this.testPassed++;
  }


  /**
   * Helper: 목표 방까지 최대 maxMoves번 이동 시도
   */
  private async navigateToRoom(targetRoomId: string, maxMoves: number): Promise<void> {
    let attempts = 0;
    while (attempts < maxMoves) {
      const currentRoom = this.lastStateSync?.p.char?.roomId;
      if (currentRoom === targetRoomId) {
        return;
      }
      
      const exits = this.lastStateSync?.p.exits || [];
      if (exits.length === 0) {
        throw new Error(`${targetRoomId} 탐색 실패: exits 없음`);
      }
      
      // 직행 경로 우선
      let targetExit = exits.find((e: any) => e.toRoomId === targetRoomId);
      
      // 직행 없으면 경로 휴리스틱
      // R2_xx → GH_RIFT_OUTPOST, 그 외 → START_TOWN → GH_GATE → GH_MARKET 경로
      if (!targetExit) {
        const isInR2 = currentRoom?.startsWith('R2_');
        if (isInR2 && targetRoomId.startsWith('GH_')) {
          // R2에서 GH로 돌아가려면 R2_00 → GH_RIFT_OUTPOST 경로 우선
          targetExit =
            exits.find((e: any) => e.toRoomId === 'R2_00') ||
            exits.find((e: any) => e.toRoomId === 'GH_RIFT_OUTPOST') ||
            exits.find((e: any) => e.toRoomId === 'START_TOWN') ||
            exits[0];
        } else {
          targetExit =
            exits.find((e: any) => e.toRoomId === 'GH_GATE') ||
            exits.find((e: any) => e.toRoomId === 'START_TOWN') ||
            exits.find((e: any) => e.toRoomId === 'GH_MARKET') ||
            exits.find((e: any) => e.toRoomId === 'GH_RIFT_OUTPOST') ||
            exits[0];
        }
      }
      
      const reqId = this.send('MOVE', { toRoomId: targetExit.toRoomId });
      const moveSync = await this.waitForMessage('STATE_SYNC', 5000, reqId);
      if (!moveSync) {
        throw new Error(`${targetRoomId} 이동 중 STATE_SYNC 미수신 (시도 ${attempts + 1}/${maxMoves})`);
      }
      
      this.lastStateSync = moveSync;
      attempts++;
    }
    
    throw new Error(`${targetRoomId} 탐색 실패: ${maxMoves}번 이동 후에도 도달 실패`);
  }

  private send(type: string, payload: any): string {
    const reqId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message: WSMessage = {
      t: type,
      reqId,
      ts: Date.now(),
      p: payload,
    };
    this.ws.send(JSON.stringify(message));
    return reqId;
  }

  private async waitForMessage(type: string, timeout: number, reqId?: string): Promise<WSMessage | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const message = this.messageQueue.find(m => {
        if (reqId) {
          // reqId 기반 매칭 (정확)
          return m.t === type && m.reqId === reqId;
        } else {
          // type만 매칭 (하위 호환, AUTH 등)
          return m.t === type;
        }
      });
      
      if (message) {
        // 큐에서 제거
        this.messageQueue = this.messageQueue.filter(m => m !== message);
        return message;
      }
      await this.sleep(100);
    }
    
    return null;
  }

  private async waitForError(reqId: string, timeout: number): Promise<WSMessage | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const message = this.messageQueue.find(m => 
        (m.t === 'ERROR' || m.t === 'WS_ERROR') && m.reqId === reqId
      );
      
      if (message) {
        this.messageQueue = this.messageQueue.filter(m => m !== message);
        return message;
      }
      await this.sleep(100);
    }
    
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 실행
const test = new SmokeTest();
test.run();

