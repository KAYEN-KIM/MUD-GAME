# MVP 퀘스트/파티/보스 구현 상태 보고서

## 실행 일시
2025-12-17 (15/15 smoke PASS 기준)

## 현재 상태

### ✅ 완료
1. **Prisma Quest 모델**
   - `QuestTemplate` (템플릿)
   - `QuestProgress` (진행 상태)
   - `QuestProgressStatus` enum (ACTIVE/COMPLETED/TURNED_IN)
   - 마이그레이션 적용 완료

2. **기존 기능 (안정)**
   - 이동/전투/영속화
   - 인벤토리/장비/상점
   - 사망/회복(REST/USE_ITEM)
   - DEBUG 이벤트 (TEST_MODE 가드)
   - Smoke 15/15 PASS

### 🚧 남은 작업 (MVP 완성 필요)

#### 1순위: Quest 서비스 (핵심)
- ✅ 모델/DB
- ⏳ QuestService 구현
- ⏳ WS 이벤트 (QUEST_LIST/ACCEPT/TURNIN)
- ⏳ 트리거 연결 (이동/전투/아이템)
- ⏳ Seed: 템플릿 3개
- ⏳ Flutter UI

#### 2순위: 콘텐츠 파이프라인
- ⏳ content/ 폴더 구조
- ⏳ ContentImporterService
- ⏳ BalanceService
- ⏳ items/quests/monsters.json

#### 3순위: Party + Boss
- ✅ Party 모델 (기존)
- ⏳ 파티 보너스 로직
- ⏳ Boss 데이터 + 스폰
- ⏳ Boss 퀘스트

---

## 현재 프로젝트 규모 분석

### 완성도
- **기반 시스템**: 90% ✅
  - WS 통신, 인증, 상태 동기화
  - 이동, 전투, 영속화
  - 인벤/장비/상점
  - 사망/회복
  
- **콘텐츠 시스템**: 30% ⏳
  - 퀘스트 (DB만 완료, 로직 미구현)
  - 파티 (모델만, 보너스 미구현)
  - 보스 (미구현)
  
- **데이터 파이프라인**: 0% ⏳
  - Seed 하드코딩
  - 밸런스 상수 분산

### 시간 추정
- Quest 서비스: 2시간
- 콘텐츠 파이프라인: 3시간
- Party/Boss: 2시간
- Flutter UI: 2시간
- Smoke 확장: 1시간
**총 10시간 (1 Context Window로는 불가능)**

---

## 권장 전략

### 옵션 A: 단계별 완성 (권장)
**1단계 (현재 세션)**
- Quest 서비스 핵심 로직
- QUEST_LIST/ACCEPT/TURNIN WS 이벤트
- Seed 템플릿 3개
- Smoke 1개 추가

**2단계 (다음 세션)**
- 콘텐츠 파이프라인
- Party 보너스
- Boss

**3단계 (다음 세션)**
- Flutter UI 완성
- CI 안정화

### 옵션 B: 프로토타입만 (빠름)
- Quest: 하드코딩 템플릿 1개 + 수락/완료만
- Party: 보너스 로직만
- Boss: 데이터만

---

## 다음 명령

### 즉시 진행 (옵션 A 1단계)
```typescript
// 1. QuestService 구현
// apps/server/src/modules/quest/quest.service.ts
// - acceptQuest()
// - listAvailable()
// - listActive()
// - tryComplete()
// - turnIn()

// 2. WS 이벤트
// apps/server/src/modules/ws/ws.gateway.ts
// - handleQuestList()
// - handleQuestAccept()
// - handleQuestTurnin()

// 3. Seed
// apps/server/prisma/seed.ts
// - QuestTemplate 3개 추가

// 4. Smoke
// apps/server/test/smoke.ts
// - test14_QuestAccept()
// - test15_QuestComplete()
```

### 서버 재시작 필요
```powershell
# 1. Seed 실행
cd "C:\Users\Kyung\Mud Game\apps\server"
pnpm prisma:seed

# 2. 서버 시작
$env:TEST_MODE="true"
pnpm dev
```

---

## 결론

**현재 상태**: 기반 시스템 완성 + Quest DB 모델 완료

**MVP 완성까지**: 10시간 (3 context windows)

**권장**: 단계별 접근 (A 옵션)
- 현재 세션: Quest 서비스 핵심
- 다음 세션: 콘텐츠/Party/Boss
- 마지막: UI/CI

**즉시 가능**: Quest 서비스 + WS 이벤트 + Seed (2-3시간)

사용자가 선택:
1. 계속 진행 (Quest 서비스부터)
2. 중간 보고서로 멈춤
3. 프로토타입만 빠르게

