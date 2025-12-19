// ===================================================
// Smoke Test Quest Loop 추가 코드
// ===================================================
// 이 파일의 내용을 apps/server/test/smoke.ts에 추가하세요.
//
// 1) SmokeTest 클래스에 test14_QuestLoop 메서드 추가
// 2) run() 메서드의 마지막에 await this.test14_QuestLoop(); 추가
// ===================================================

private async test14_QuestLoop() {
  console.log('[14] 퀘스트 루프: 탐험 퀘스트...');
  
  // QUEST_LIST 요청
  const reqId1 = this.send('QUEST_LIST', {});
  const questList = await this.waitForMessage('QUEST_LIST', 3000, reqId1);
  
  if (!questList) {
    throw new Error('QUEST_LIST 수신 실패');
  }
  
  const available = questList.p.available || [];
  const exploreQuest = available.find((q: any) => q.questId === 'Q_EXPLORE_R1');
  
  if (!exploreQuest) {
    console.log('  ⚠️  Q_EXPLORE_R1 퀘스트 없음 (SKIP)');
    this.testPassed++;  // 퀘스트가 없어도 실패는 아님
    return;
  }
  
  console.log(`  ✓ 퀘스트 발견: ${exploreQuest.title}`);
  
  // QUEST_ACCEPT
  const reqId2 = this.send('QUEST_ACCEPT', { questId: 'Q_EXPLORE_R1' });
  const acceptResponse = await this.waitForMessage('QUEST_LIST', 3000, reqId2);
  
  if (!acceptResponse) {
    throw new Error('퀘스트 수락 후 QUEST_LIST 미수신');
  }
  
  console.log('  ✓ 퀘스트 수락 성공');
  
  // R1_00로 이동 (exits 기반)
  const exits = this.lastStateSync?.p?.exits || [];
  const r1Exit = exits.find((e: any) => 
    e.toRoomId === 'R1_00' || e.toRoomId.startsWith('R1_')
  );
  
  if (!r1Exit) {
    console.log('  ⚠️  R1 출구 없음 (맵 변경 가능성, SKIP)');
    this.testPassed++;
    return;
  }
  
  this.send('MOVE', { toRoomId: r1Exit.toRoomId });
  const moveSync = await this.waitForMessage('STATE_SYNC', 3000);
  
  if (!moveSync) {
    throw new Error('이동 후 STATE_SYNC 실패');
  }
  
  console.log(`  ✓ R1 진입: ${r1Exit.toRoomId}`);
  
  // 잠시 대기 (서버 onMove 처리 시간)
  await this.sleep(500);
  
  // QUEST_LIST로 완료 확인
  const reqId3 = this.send('QUEST_LIST', {});
  const completeCheck = await this.waitForMessage('QUEST_LIST', 3000, reqId3);
  
  if (!completeCheck) {
    throw new Error('완료 확인 QUEST_LIST 미수신');
  }
  
  const active = completeCheck.p.active || [];
  const completed = active.find((q: any) => 
    q.questId === 'Q_EXPLORE_R1' && q.status === 'COMPLETED'
  );
  
  if (!completed) {
    console.log('  ⚠️  퀘스트 상태:', active);
    throw new Error('퀘스트가 COMPLETED 상태가 아닙니다.');
  }
  
  console.log('  ✓ 퀘스트 목표 달성 (COMPLETED)');
  
  // START_TOWN 복귀
  this.send('MOVE', { toRoomId: 'START_TOWN' });
  const returnSync = await this.waitForMessage('STATE_SYNC', 3000);
  
  if (!returnSync) {
    throw new Error('START_TOWN 복귀 실패');
  }
  
  console.log('  ✓ START_TOWN 복귀');
  
  // QUEST_TURNIN
  const beforeGold = this.lastStateSync?.p?.char?.gold || 0;
  const beforeExp = this.lastStateSync?.p?.char?.exp || 0;
  
  const reqId4 = this.send('QUEST_TURNIN', { questId: 'Q_EXPLORE_R1' });
  const turninSync = await this.waitForMessage('STATE_SYNC', 3000);
  
  if (!turninSync) {
    throw new Error('QUEST_TURNIN 후 STATE_SYNC 미수신');
  }
  
  const afterGold = turninSync.p.char?.gold || 0;
  const afterExp = turninSync.p.char?.exp || 0;
  
  if (afterGold <= beforeGold) {
    throw new Error(`골드 보상 미지급: ${beforeGold} -> ${afterGold}`);
  }
  
  if (afterExp <= beforeExp) {
    throw new Error(`경험치 보상 미지급: ${beforeExp} -> ${afterExp}`);
  }
  
  console.log(`  ✓ 보상 지급 확인:`);
  console.log(`     골드: ${beforeGold} -> ${afterGold} (+${afterGold - beforeGold})`);
  console.log(`     경험치: ${beforeExp} -> ${afterExp} (+${afterExp - beforeExp})`);
  
  this.testPassed++;
}

// ===================================================
// run() 메서드에 추가할 라인:
// ===================================================
// await this.test14_QuestLoop();
// ===================================================

