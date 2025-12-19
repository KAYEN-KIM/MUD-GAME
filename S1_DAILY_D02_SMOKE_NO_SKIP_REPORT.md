# S1 Daily Quest D02 제공 + Smoke "스킵 제거" + 콘텐츠 가드레일

## 📋 변경 요약

- **문제**: smoke 테스트에서 `Q_S01_D02` 데일리 퀘스트를 찾지 못해 스킵 처리되던 문제
- **원인**: `Q_S01_D02`의 `minLevel: 2`로 설정되어 있어 level 1 테스트 캐릭터가 접근 불가
- **해결책**: 
  - `Q_S01_D02.minLevel`을 1로 낮춤 (smoke 테스트 캐릭터가 level 1)
  - smoke 테스트에서 스킵 제거하고 완료까지 검증하도록 강화
  - `validate_content.js`에 필수 퀘스트 존재 검증 추가 (Q_S01_D02)
  - `handleQuestTurnin`에서 `sendStateSync`에 `message.reqId` 전달하도록 수정

## 📁 변경 파일 목록

### 수정
1. **`apps/server/content/quests.json`**
   - `Q_S01_D02.minLevel`: 2 → 1
   
2. **`tools/validate_content.js`**
   - `checkRequiredQuests()` 함수 추가: Q_S01_D02 존재 검증
   - main 함수에 필수 퀘스트 검증 추가

3. **`apps/server/test/smoke.ts`**
   - `test14_DailyQuest()` 완전 재작성:
     - 스킵 로직 제거 (Q_S01_D02를 찾지 못하면 FAIL)
     - QUEST_ACCEPT → MOVE (R1_01) → QUEST_LIST (완료 확인) → QUEST_TURNIN 전체 플로우 검증
     - 보상 (gold/exp) 증가 확인 추가
     - DB BFS 기반 네비게이션 활용

4. **`apps/server/src/modules/ws/ws.gateway.ts`**
   - `handleQuestTurnin()`: `sendStateSync(client, clientData.characterId, message.reqId)` (reqId 추가)
   - smoke 테스트가 reqId 기반으로 STATE_SYNC를 기다릴 수 있도록 수정

### 신규
5. **`S1_DAILY_D02_SMOKE_NO_SKIP_REPORT.md`** (본 파일)

## 🧪 테스트 결과

### Content Validation
```bash
cd "C:\Users\Kyung\Mud Game"
pnpm content:validate
```

**결과**: ✅ PASS (12/12 checks passed)
- Q_S01_D02 필수 퀘스트 존재 검증 추가됨

### Seed
```bash
cd "C:\Users\Kyung\Mud Game\apps\server"
pnpm prisma:seed
```

**결과**: ✅ PASS (49개 퀘스트 로드 완료)

### Smoke Test
```bash
cd "C:\Users\Kyung\Mud Game\apps\server"
# 1. 서버 빌드
pnpm build

# 2. 서버 재시작 (터미널 A)
$env:TEST_MODE="true"
$env:PORT="3000"
pnpm start

# 3. smoke 테스트 실행 (터미널 B, 서버 시작 후 3초 대기)
timeout /t 3
$env:TEST_MODE="true"
pnpm smoke
```

**예상 결과**: ✅ PASS
- [13] 데일리 퀘스트 테스트가 더 이상 스킵되지 않고 완료까지 진행
- QUEST_ACCEPT → VISIT_ROOM (R1_01) → QUEST_TURNIN 전체 플로우 검증
- 보상 (gold/exp) 증가 확인

**참고**: 
- 서버를 재시작하지 않으면 `ws.gateway.ts` 변경사항이 반영되지 않아 테스트가 실패할 수 있습니다.
- `QUEST_TURNIN 후 STATE_SYNC 수신 실패` 에러가 발생하면 서버 재시작이 필요합니다.

## 🎮 게임플레이 영향

- **긍정적 영향**: 없음 (기존 데일리 퀘스트 접근 조건 완화)
  - `Q_S01_D02`가 level 1부터 접근 가능해짐 (기존: level 2)
  - VISIT_ROOM 목표이므로 전투 불필요
  
- **경제 영향**: 최소
  - 보상: gold 80, exp 50, ITEM_LEDGER_STAMP_S1 x1
  - 인장(ITEM_LEDGER_SEAL_S1) 보상 없음

## 🚨 리스크

- **낮음**: minLevel 1로 낮춤으로 인한 밸런스 리스크 미미
  - R1_01 방문만 요구하므로 전투 위험 없음
  - 보상도 소액/소모품 중심
  
- **낮음**: smoke 테스트 강화로 CI에서 데일리 퀘스트 회귀 조기 발견 가능

## 📋 PR 범위

### In Scope
- Q_S01_D02 minLevel 조정
- smoke 테스트 스킵 제거 및 완료 검증
- validate_content 가드레일 추가
- QUEST_TURNIN reqId 전달 버그 수정

### Out of Scope
- QuestService 리팩토링
- Flutter UI 변경
- 다른 데일리 퀘스트 추가/수정

## 🔗 후속 과제

1. **데일리 퀘스트 콘텐츠 확장** (Future)
   - Q_S01_D03, D04, D05 추가
   - cadence별 다양한 퀘스트 목표 타입 활용
   
2. **smoke 테스트 추가 시나리오** (Optional)
   - WEEKLY 퀘스트 검증
   - QUEST_ABANDON 플로우 검증

---

**작성일**: 2025-12-19  
**브랜치**: `feat/s1-daily-d02-no-skip`  
**작성자**: AI Assistant (Claude Sonnet 4.5)

