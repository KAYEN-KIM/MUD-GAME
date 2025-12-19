# Season 1 Soft 3-Week Window + Bonus Week Cosmetics 구현 보고서

**작성일**: 2025-12-18  
**브랜치**: `feat/season1-soft-3week-bonus-cosmetics-v1`  
**목표**: 시즌 해금/표시 윈도우를 21일(3주)로 변경하고, 3주차에 보너스 주간 전용 코스메틱 보상 추가

---

## 📋 변경 요약

### 핵심 변경 사항
1. **시즌 길이 14일 → 21일 (3주)** 변경
2. **보너스 주간 (3주차, 15~21일)** 개념 도입
3. **보너스 주간 전용 퀘스트 2개** 추가 (인장 지급 없음)
4. **보너스 주간 전용 코스메틱 아이템 2종** 추가
5. **주차 기반 퀘스트 게이팅** 로직 구현

### 설계 원칙
- **충돌 최소화**: `ws.gateway.ts`, `party/*`, `shop/*` 로직은 수정하지 않음
- **데이터 중심**: 콘텐츠는 JSON 파일로 관리, 로직은 `SeasonService`/`QuestService`만 수정
- **2주 난이도 유지**: 기존 스탬프 42개, 메타 목표, 밸런스는 그대로 유지
- **S2~S10 확장성**: 템플릿 기반 복붙 가능한 구조

---

## 📂 변경 파일 목록

### 서버 (Server)

#### 1. `apps/server/src/modules/season/season.service.ts`
**변경 내용**:
- `seasonLengthDays` 기본값: `14` → `21`
- `getDayIndexInSeason(nowUtc: Date): number` 메서드 추가
- `getWeekIndexInSeason(dayIndex: number): number` 메서드 추가 (1~3 주차 계산)
- `getSeasonStatus()` 내부 로직을 `getDayIndexInSeason()` 호출로 리팩토링

**주요 코드**:
```typescript
private get seasonLengthDays(): number {
  const envVal = process.env.SEASON_LENGTH_DAYS;
  return envVal ? parseInt(envVal, 10) : 21; // 14 → 21
}

getDayIndexInSeason(nowUtc: Date = new Date()): number {
  // 시즌 내 일차 (1..21) 계산
}

getWeekIndexInSeason(dayIndex: number): number {
  const weekIndex = Math.ceil(dayIndex / 7);
  return Math.min(3, Math.max(1, weekIndex)); // 1~3 clamp
}
```

---

#### 2. `apps/server/src/modules/quest/quest.service.ts`
**변경 내용**:
- `listAvailable()`: 보너스 주 게이팅 로직 추가 (weekIndex 기반)
- `acceptQuest()`: 보너스 주 게이팅 검증 추가

**게이팅 규칙**:
- **1~2주차 (weekIndex 1~2)**:
  - 기존 주간 퀘스트 (`Q_S\d{2}_W\d{2}`) 노출
  - 보너스/엘리트 퀘스트 (`_WB`, `_ELITE_`) 숨김
- **3주차 (weekIndex 3)**:
  - 기존 주간 퀘스트 **신규 수락 불가** (available에서 제외)
  - 보너스/엘리트 퀘스트 **노출 및 수락 가능**

**주요 코드**:
```typescript
// listAvailable() 내부
const weekIndex = this.seasonService.getWeekIndexInSeason(dayIndex);
const isWeeklyNormal = /^Q_S\d{2}_W\d{2}$/.test(t.id);
const isWeeklyBonus = /^Q_S\d{2}_WB\d{2}$/.test(t.id);
const isElite = /^Q_S\d{2}_ELITE_\d{2}$/.test(t.id);

if (weekIndex === 3) {
  if (isWeeklyNormal) return false; // 3주차: 기존 주간 숨김
} else {
  if (isWeeklyBonus || isElite) return false; // 1~2주차: 보너스/엘리트 숨김
}
```

---

#### 3. `apps/server/src/content/items.json`
**변경 내용**:
- 보너스 주간 코스메틱 아이템 2종 추가

**추가 아이템**:
```json
{
  "id": "ITEM_ICON_BONUS_S1",
  "name": "보너스 아이콘(S1): 균열의 미광",
  "type": "material",
  "rarity": "rare",
  "priceBuy": 0,
  "priceSell": 0
},
{
  "id": "ITEM_TITLE_BONUS_S1",
  "name": "칭호(S1): 보너스 위크 러너",
  "type": "material",
  "rarity": "epic",
  "priceBuy": 0,
  "priceSell": 0
}
```

---

#### 4. `apps/server/content/quests.json`
**변경 내용**:
- 보너스 주간 전용 퀘스트 2개 추가

**추가 퀘스트**:

| Quest ID | 타입 | 목표 | 보상 |
|----------|------|------|------|
| `Q_S01_WB01` | 보너스 주간 (WB) | R1에서 몬스터 60마리 처치 | 골드 700, 경험치 500, 포션 5개, **아이콘(ITEM_ICON_BONUS_S1)** |
| `Q_S01_ELITE_01` | 엘리트 | R1에서 몬스터 200마리 처치 | 골드 400, 경험치 450, **칭호(ITEM_TITLE_BONUS_S1)** |

**주요 특징**:
- `giverRoomId` / `turninRoomId`: `GH_LEDGER_OFFICE`
- `repeatable`: `false` (보너스 주간 1회성)
- **인장(ITEM_LEDGER_SEAL_S1) 지급 없음** (파워 인플레 방지)

---

### 클라이언트 (Flutter)

#### 5. `mud_client/lib/features/quest/widgets/season_progress_widget.dart`
**변경 내용**:
- `dayIndexInSeason >= 15`일 때 **"보너스" 배지** 표시 추가
- 불필요한 import 제거

**UI 변경**:
```dart
if (seasonStatus.dayIndexInSeason >= 15) ...[
  const SizedBox(width: 8),
  Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: Colors.purple[100],
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text(
      '보너스',
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        color: Colors.purple[800],
      ),
    ),
  ),
],
```

**표시 예시**:
- `Season 1 — 10/21일차` (일반)
- `Season 1 — 16/21일차 [보너스]` (보너스 주간)

---

## 🧪 테스트 가이드

### 서버 테스트

#### 1. 데이터베이스 시드
```powershell
cd apps/server
pnpm prisma:seed
```
**확인 사항**:
- `Q_S01_WB01`, `Q_S01_ELITE_01` 퀘스트 생성 확인
- `ITEM_ICON_BONUS_S1`, `ITEM_TITLE_BONUS_S1` 아이템 생성 확인

#### 2. Smoke 테스트
```powershell
cd apps/server
$env:TEST_MODE="true"
pnpm smoke
```
**확인 사항**:
- 기존 15/15 테스트 모두 PASS
- `SEASON_STATUS`의 `seasonLengthDays` 값이 21로 반환되는지 확인

#### 3. 보너스 주 게이팅 테스트 (수동)

**시나리오 A: 1~2주차 (dayIndex 1~14)**
1. 서버 시작 (현재 시간이 시즌 1~14일차인 상태)
2. 클라이언트 로그인 → 퀘스트 탭 이동
3. **예상**: 
   - 주간 탭에 `Q_S01_W01` 노출
   - `Q_S01_WB01`, `Q_S01_ELITE_01` **비노출**
4. `Q_S01_WB01` 수락 시도 (직접 WS 메시지 전송)
5. **예상**: `ERROR` 응답 ("보너스 주간 퀘스트는 3주차부터 수락할 수 있습니다.")

**시나리오 B: 3주차 (dayIndex 15~21)**
1. 서버 `SEASON_EPOCH_ISO` 환경 변수를 조작하여 15일차로 설정
   ```powershell
   $env:SEASON_EPOCH_ISO="2025-12-03T00:00:00+09:00"
   ```
2. 서버 재시작 → 클라이언트 로그인
3. **예상**:
   - 시즌 진행도에 **"보너스" 배지** 표시
   - 주간 탭에 `Q_S01_WB01`, `Q_S01_ELITE_01` 노출
   - `Q_S01_W01` **신규 수락 불가** (available에서 제외)
4. `Q_S01_WB01` 수락 → 60마리 처치 → 턴인
5. **예상**: 보상으로 `ITEM_ICON_BONUS_S1` 획득, **인장 미지급** 확인

---

### Flutter 테스트

#### 1. Flutter Analyze
```powershell
cd mud_client
flutter analyze
```
**확인 사항**:
- 기존 경고/오류는 그대로 (제가 수정한 파일에서 새로운 오류 없음)
- `season_progress_widget.dart`: unused import 경고 제거 확인

#### 2. UI 수동 테스트
1. 앱 실행 → 로그인
2. 퀘스트 탭 → 시즌 진행도 위젯 확인
   - **1~14일차**: "Season 1 — n/21일차" (배지 없음)
   - **15~21일차**: "Season 1 — n/21일차 [보너스]" (보라색 배지)
3. 주간 탭에서 퀘스트 목록 확인
   - **1~2주차**: `[W] 주간 계약: R1 소탕` 노출
   - **3주차**: `[WB] 보너스 주간: 잔재 소탕`, `[ELITE] 보너스 주간: 과투입` 노출

---

## 🔍 알려진 영향 및 제약

### 긍정적 영향
1. **2주 클리어 난이도 유지**: 기존 플레이어는 2주 안에 스탬프 42개 달성 가능
2. **3주차 선택지 제공**: 빡세게 못한 플레이어에게 추가 1주 여유 제공
3. **코스메틱 보상**: 인장 대신 아이콘/칭호로 파워 인플레 방지
4. **S2~S10 확장 용이**: 템플릿 기반 복붙으로 빠른 콘텐츠 추가 가능

### 제약 사항
1. **코스메틱 장착 UI 없음**: 현재 아이템은 인벤토리에만 존재 (후속 PR에서 구현)
2. **보너스 주간 주간 퀘스트**: 기존 `Q_S01_W01`이 이미 active인 경우 턴인은 가능 (재수락만 불가)
3. **날짜 조작 테스트**: 로컬 테스트 시 `SEASON_EPOCH_ISO` 환경 변수 조작 필요

---

## 📦 Season 2~10 확장 템플릿

### 1. 아이템 추가 템플릿
```json
{
  "id": "ITEM_ICON_BONUS_S{NN}",
  "name": "보너스 아이콘(S{NN}): {THEME}",
  "type": "material",
  "rarity": "rare",
  "priceBuy": 0,
  "priceSell": 0
},
{
  "id": "ITEM_TITLE_BONUS_S{NN}",
  "name": "칭호(S{NN}): {THEME}",
  "type": "material",
  "rarity": "epic",
  "priceBuy": 0,
  "priceSell": 0
}
```

### 2. 퀘스트 추가 템플릿
```json
{
  "id": "Q_S{NN}_WB01",
  "title": "[WB] 보너스 주간: {TITLE}",
  "description": "보너스 주간 전용 퀘스트입니다.",
  "giverRoomId": "GH_LEDGER_OFFICE",
  "turninRoomId": "GH_LEDGER_OFFICE",
  "minLevel": 1,
  "repeatable": false,
  "objectivesJson": [{"type": "KILL_IN_ZONE", "zoneId": "{ZONE}", "count": {COUNT}}],
  "rewardsJson": {
    "gold": {GOLD},
    "exp": {EXP},
    "items": [
      {"itemId": "ITEM_POTION_HP_S", "qty": 5},
      {"itemId": "ITEM_ICON_BONUS_S{NN}", "qty": 1}
    ]
  }
},
{
  "id": "Q_S{NN}_ELITE_01",
  "title": "[ELITE] 보너스 주간: {TITLE}",
  "description": "보너스 주간 선택 목표입니다.",
  "giverRoomId": "GH_LEDGER_OFFICE",
  "turninRoomId": "GH_LEDGER_OFFICE",
  "minLevel": 1,
  "repeatable": false,
  "objectivesJson": [{"type": "KILL_IN_ZONE", "zoneId": "{ZONE}", "count": {ELITE_COUNT}}],
  "rewardsJson": {
    "gold": {ELITE_GOLD},
    "exp": {ELITE_EXP},
    "items": [{"itemId": "ITEM_TITLE_BONUS_S{NN}", "qty": 1}]
  }
}
```

**적용 방법**:
- `{NN}`: 시즌 번호 (예: `02`, `03`, ...)
- `{THEME}`: 시즌 테마 (예: "균열의 미광", "시길의 잔향")
- `{ZONE}`: 타겟 존 (예: `R1`, `R2_BOSS`)
- `{COUNT}`, `{GOLD}`, `{EXP}`: 밸런스 값

**게이팅 로직**: `quest.service.ts`의 정규식 패턴이 자동으로 `_WB`, `_ELITE_` 인식

---

## ✅ PR 머지 조건 (Self-Check)

### 서버
- [x] `seasonLengthDays` 기본값 21로 변경
- [x] `getWeekIndexInSeason()` 메서드 추가 (1~3 반환)
- [x] `listAvailable()` / `acceptQuest()`에 weekIndex 게이팅 로직 추가
- [x] 보너스 주간 퀘스트 2개 추가 (`Q_S01_WB01`, `Q_S01_ELITE_01`)
- [x] 보너스 주간 아이템 2종 추가 (`ITEM_ICON_BONUS_S1`, `ITEM_TITLE_BONUS_S1`)
- [x] 보너스 주간 퀘스트 보상에 **인장 미포함** 확인
- [x] 리팅 오류 없음

### 클라이언트
- [x] 시즌 진행도 표시 21일로 수정
- [x] `dayIndexInSeason >= 15`일 때 "보너스" 배지 표시
- [x] 퀘스트 UI에서 WB/ELITE 퀘스트 표시 (기존 weekly 탭에 표시)
- [x] Flutter analyze 기존 오류 회귀 없음

### 테스트
- [x] Docker 인프라 시작 ✅
- [x] Prisma 스키마 마이그레이션 ✅ (`prisma db push` 완료)
- [x] 데이터베이스 시드 완료 ✅ (31개 퀘스트, 25개 아이템)
- [x] Flutter 코드 분석 ✅ (새 오류 없음)
- [ ] `pnpm smoke` PASS (서버 수동 시작 필요)
- [ ] 1~2주차: 기존 주간 노출, WB/ELITE 숨김 (수동 테스트 필요)
- [ ] 3주차: WB/ELITE 노출, 기존 주간 신규 수락 불가 (수동 테스트 필요)

**상세 테스트 결과**: `TEST_RESULTS_REPORT.md` 참조

---

## 📝 후속 작업 (Next PR)

1. **✅ 코스메틱 장착/표시 시스템** (별도 PR 완료):
   - 프로필에 칭호/아이콘 표시 UI
   - 인벤토리에서 장착 기능
   - **보고서**: `COSMETIC_EQUIP_ICON_TITLE_REPORT.md` 참조
2. **시즌 종료 처리**:
   - 21일 경과 후 시즌 롤오버 로직
   - 보너스 주간 퀘스트 리셋/제거
3. **Season 2 콘텐츠**:
   - 위 템플릿 기반으로 S02 보너스 주간 퀘스트 추가
4. **파티/보스 통합**:
   - 보너스 주간에 파티 EXP 보너스 증가 등 특수 규칙

---

## 🏁 결론

- **21일 시즌 윈도우**로 확장하되, **2주 난이도 유지** 성공
- **보너스 주간** 개념으로 선택지 제공, 인장 미지급으로 파워 인플레 방지
- **충돌 최소화** 원칙 준수 (ws.gateway.ts, party/*, shop/* 미수정)
- **S2~S10 확장 템플릿** 제공으로 콘텐츠 확장 용이

---

**작성자**: AI Assistant  
**검토 필요**: 보너스 주간 밸런스 (60마리 vs 200마리), 코스메틱 보상 매력도

