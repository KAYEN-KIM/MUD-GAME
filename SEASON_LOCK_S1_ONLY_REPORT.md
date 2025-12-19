# Season Lock S1-only Report (Production Gate)

**날짜**: 2025-12-19  
**작업**: Season 1만 프로덕션 노출, Season 2+ 잠금  
**목표**: 프로덕션 안정성 확보 + TEST_MODE 유연성  
**브랜치**: feat/season-lock-s1-only

---

## 요약

- **목적**: 시즌 2 이상 콘텐츠를 프로덕션에서 숨기고 접근 차단 (repo 유지, 개발/테스트는 허용)
- **정책**:
  - `MAX_UNLOCKED_SEASON` 환경변수가 명시되면 그 값 우선 (1~99)
  - 환경변수 없고 `TEST_MODE=true`이면 잠금 우회 (사실상 99)
  - 환경변수 없고 `TEST_MODE=false`이면 default=1 (프로덕션 안전 기본값)
- **범위**: Rooms/Quests/Shops 노출+차단 (이중 방어)
- **충돌 최소화**: WS 프로토콜 타입 추가 없음, STATE_SYNC 경량 유지

---

## 변경 파일

### 1. `apps/server/src/utils/season_lock.ts` (신규)

**역할**: 시즌 잠금 정책 중앙 관리

**핵심 함수**:
1. `getMaxUnlockedSeason()`: 환경변수/TEST_MODE 기반 최대 시즌 계산
2. `parseSeasonFromId(id)`: Room/Quest/Shop/Item ID에서 시즌 번호 추출
   - Room: `R{n}_*` → season n
   - Quest: `Q_S{nn}_*` → season n
   - Shop: `SHOP_S{n}*` → season n
   - Item: `*_S{nn}` → season n
3. `isUnlockedId(id, maxSeason?)`: 주어진 ID가 잠금 해제되었는지 확인

**정책 우선순위**:
```
MAX_UNLOCKED_SEASON (명시) > TEST_MODE bypass (true) > default=1 (prod)
```

---

### 2. `apps/server/src/modules/ws/ws.gateway.ts`

#### 변경 A: STATE_SYNC exits 필터링

```typescript
let exitsData = (character as any)?.exits || undefined;

// 시즌 잠금: 잠긴 시즌으로 가는 출구 필터링
if (exitsData && Array.isArray(exitsData)) {
  const maxSeason = getMaxUnlockedSeason();
  exitsData = exitsData.filter((exit: any) => isUnlockedId(exit.toRoomId, maxSeason));
}
```

**효과**: 프로덕션에서 GH_RIFT_OUTPOST에 R2_00 출구가 보이지 않음

---

#### 변경 B: MOVE 액션 차단

```typescript
// 시즌 잠금: 잠긴 시즌 방으로 이동 차단
if (targetRoomId && !isUnlockedId(targetRoomId, getMaxUnlockedSeason())) {
  const season = parseSeasonFromId(targetRoomId);
  this.sendError(client, message.reqId, 'SEASON_LOCKED', 
    `시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
  return;
}
```

**효과**: 직접 MOVE 요청으로 R2_00 접근 시도 시 ERROR로 거절

---

### 3. `apps/server/src/modules/quest/quest.service.ts`

#### 변경 A: listAvailable() 필터링

```typescript
const maxUnlockedSeason = getMaxUnlockedSeason();

const filteredBySeasonTemplates = templates.filter(t => {
  // 시즌 잠금: 잠긴 시즌 퀘스트 숨김
  if (!isUnlockedId(t.id, maxUnlockedSeason)) {
    return false;
  }
  // ... 기존 시즌/보너스주 게이팅 ...
});
```

**효과**: 퀘스트 목록에서 Q_S02_* 제외

---

#### 변경 B: acceptQuest() 차단

```typescript
// 시즌 잠금: 잠긴 시즌 퀘스트 수락 차단
if (!isUnlockedId(questId, getMaxUnlockedSeason())) {
  const season = parseSeasonFromId(questId);
  throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
}
```

**효과**: 직접 QUEST_ACCEPT 요청 시 거절

---

#### 변경 C: turnIn() 차단

```typescript
// 시즌 잠금: 잠긴 시즌 퀘스트 턴인 차단
if (!isUnlockedId(questId, getMaxUnlockedSeason())) {
  const season = parseSeasonFromId(questId);
  throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
}
```

**효과**: 잠긴 시즌 퀘스트 턴인 차단 (프로덕션에서는 발생 불가능하지만 방어적 구현)

---

### 4. `apps/server/src/modules/shop/shop.service.ts`

#### 변경 A: listShop() 필터링

```typescript
listShop(roomId: string): ShopDef | null {
  const shop = this.getShopByRoom(roomId);
  if (!shop) return null;
  
  // 시즌 잠금: 잠긴 시즌 상점 숨김
  const maxSeason = getMaxUnlockedSeason();
  if (!isUnlockedId(shop.id, maxSeason)) {
    return null;
  }
  
  // 상점 아이템도 시즌 잠금 필터링
  const filteredItems = shop.items.filter(item => isUnlockedId(item.itemId, maxSeason));
  
  return { ...shop, items: filteredItems };
}
```

**효과**: SHOP_LIST에서 SHOP_S2_* 및 S2 아이템 제외

---

#### 변경 B: buyItem() 차단

```typescript
// 시즌 잠금: 잠긴 시즌 상점 차단
if (!isUnlockedId(shop.id, maxSeason)) {
  const season = parseSeasonFromId(shop.id);
  throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
}

// 시즌 잠금: 잠긴 시즌 아이템 구매 차단
if (!isUnlockedId(itemId, maxSeason)) {
  const season = parseSeasonFromId(itemId);
  throw new Error(`시즌 ${season}은(는) 아직 잠겨 있습니다. (Coming Soon)`);
}
```

**효과**: 직접 SHOP_BUY 요청 시 거절, SHOP_BUY_ERR로 응답 (기존 구조 유지)

---

### 5. `apps/server/src/modules/season/season.service.ts`

#### 변경: getSeasonStatus() 응답에 maxUnlockedSeason 추가

```typescript
return {
  serverNowUtcMs: nowUtc.getTime(),
  currentSeason,
  seasonStartUtcMs,
  seasonEndUtcMs,
  nextDailyResetUtcMs,
  nextWeeklyResetUtcMs,
  seasonLengthDays,
  dayIndexInSeason,
  maxUnlockedSeason: getMaxUnlockedSeason(), // 신규 필드
};
```

**목적**: Flutter 클라이언트가 "Season 2: Coming Soon" 안내 표시 가능 (선택적 UI 개선)

---

## 테스트 결과

### 1. content:validate

```bash
pnpm content:validate
```

**결과**: ✅ PASS (11/11)

```
[validate_content] ✅ VALIDATION PASSED
```

---

### 2. smoke 테스트 (TEST_MODE=true)

**명령**:
```bash
cd apps/server
$env:TEST_MODE="true"  # Windows PowerShell
# TEST_MODE=true         # Linux/Mac
pnpm smoke
```

**상태**: ⚠️ **미실행** (Docker Desktop 미실행 상태)

**예상 결과**:
- ✅ **17/17 PASS** (시즌 잠금 우회로 S2 E2E 유지)
- TEST_MODE=true일 때 `getMaxUnlockedSeason()` = 99 → 모든 시즌 허용
- 기존 smoke (test0~16) 영향 없음

---

### 3. 수동 검증 체크리스트 (프로덕션 가정)

**환경 설정**:
```bash
# TEST_MODE 미설정 또는 false
# MAX_UNLOCKED_SEASON 미설정 (default=1)
```

**검증 시나리오**:

| 항목 | 테스트 방법 | 예상 결과 |
|------|-------------|-----------|
| **exits 숨김** | GH_RIFT_OUTPOST에서 STATE_SYNC 확인 | R2_00 출구 안 보임 |
| **MOVE 차단** | 콘솔에서 `MOVE toRoomId=R2_00` 전송 | ERROR: "시즌 2 잠김" |
| **Quest 숨김** | QUEST_LIST 확인 | Q_S02_* 안 보임 |
| **Quest 수락 차단** | `QUEST_ACCEPT questId=Q_S02_001` | ERROR: "시즌 2 잠김" |
| **Shop 숨김** | R2_00에서 SHOP_LIST (접근 가능 시) | null 반환 또는 아이템 0개 |
| **Shop 구매 차단** | `SHOP_BUY itemId=ITEM_ICON_BOSS_S02` | SHOP_BUY_ERR: "시즌 2 잠김" |

**중요**: 이 테스트는 Docker + seed + 서버 실행 후 수동으로 진행 필요

---

## 환경변수 가이드

### 프로덕션 배포

```bash
# .env (production)
TEST_MODE=false
# MAX_UNLOCKED_SEASON 미설정 (default=1)
```

**효과**: 시즌 1만 허용

---

### 로컬 개발/테스트

```bash
# .env (local)
TEST_MODE=true
# MAX_UNLOCKED_SEASON 미설정 (잠금 우회, 모든 시즌 허용)
```

**효과**: S2 E2E smoke 통과, 개발 편의성 유지

---

### 시즌 2 프로덕션 오픈 (미래)

```bash
# .env (production, season 2 unlocked)
TEST_MODE=false
MAX_UNLOCKED_SEASON=2
```

**효과**: 시즌 1~2 허용, 시즌 3+ 잠김

---

### 잠금 테스트 (로컬)

```bash
# TEST_MODE를 true로 두되, 명시적으로 잠금 테스트
TEST_MODE=true
MAX_UNLOCKED_SEASON=1
```

**효과**: 환경변수가 최우선이므로 TEST_MODE와 관계없이 시즌 1만 허용

---

## 프로토콜 안정성

### WS 메시지 타입

- ✅ **타입 추가 없음**
- ✅ **STATE_SYNC 페이로드 구조 불변** (exits는 기존 필드)
- ✅ **ERROR 응답 기존 구조 재사용** (code: 'SEASON_LOCKED')
- ✅ **SHOP_BUY_ERR 기존 구조 재사용**

### 하위호환

- ✅ **SeasonStatus.maxUnlockedSeason**: 필드 추가 (optional, Flutter에서 없으면 99 기본값)
- ✅ **기존 클라이언트**: maxUnlockedSeason 필드 무시 가능

---

## 한계 및 향후 과제

### 1. 시즌 패턴 가정

**현재 로직**:
- Room: `R{n}_*` 패턴만 인식
- Quest: `Q_S{nn}_*` 패턴만 인식
- Shop: `SHOP_S{n}*` 패턴만 인식

**한계**:
- 패턴이 다르면 시즌 0 (무관)으로 판단 → 항상 허용
- 예: `SPECIAL_ROOM_S02` (언더스코어 위치 차이) → 시즌 0으로 인식

**해결**: 콘텐츠 네이밍 가이드 준수 필요

---

### 2. S1 Boss Trophy 교환소 접근 불가 (기존 이슈)

**배경**:
- GH_LEDGER_OFFICE에 S1 ledger exchange + S1 boss trophy 2개 상점 존재
- ShopService.listShop()은 첫 번째 상점만 반환
- **S1 boss trophy 교환소 접근 불가** (이번 PR 범위 밖)

**해결**: 별도 PR로 S1 boss trophy 교환소도 분리 필요

---

### 3. Flutter UI 안내 (미구현)

**현재**:
- SeasonStatus.maxUnlockedSeason 필드만 추가됨
- Flutter에서 "Season 2: Coming Soon" 안내 표시는 별도 작업 필요

**제안**:
- `mud_client/lib/features/quest/widgets/season_progress_widget.dart`에 1줄 안내 추가
- 예: `maxUnlockedSeason==1 → "Season 2: Coming Soon"`

---

## 실행 체크리스트

### 개발자 액션 필요

1. **Docker Desktop 시작**
   ```bash
   # Docker Desktop 앱 실행
   ```

2. **Docker Compose 시작**
   ```bash
   cd "C:\Users\Kyung\Mud Game\infra"
   docker compose up -d
   ```

3. **Prisma Seed 실행**
   ```bash
   cd "../apps/server"
   pnpm prisma:seed
   ```

4. **Smoke 테스트 (TEST_MODE)**
   ```bash
   $env:TEST_MODE="true"
   pnpm smoke
   ```

   **예상**: 17/17 PASS

5. **수동 검증 (프로덕션 모드)**
   ```bash
   # .env에서 TEST_MODE=false 설정 (또는 미설정)
   # MAX_UNLOCKED_SEASON 미설정
   pnpm dev
   ```

   - Flutter 앱 실행 → GH_RIFT_OUTPOST에서 R2_00 출구 안 보이는지 확인

---

## 결론

- ✅ **시즌 1만 프로덕션 노출** (default 정책)
- ✅ **이중 방어** (숨김 + 차단)
- ✅ **TEST_MODE 유연성** (개발/테스트 우회)
- ✅ **content:validate PASS**
- ✅ **프로토콜 안정성** (WS 타입 추가 없음)
- ⚠️ **smoke 테스트 대기 중** (Docker 필요)
- ⚠️ **수동 검증 필요** (프로덕션 모드)

### 회귀 방지 효과

- 시즌 2 맵/퀘스트/상점 접근 시도 → ERROR로 거절
- smoke 테스트에서 시즌 잠금 우회 확인 (TEST_MODE=true)
- 환경변수 조작으로 잠금 테스트 가능 (MAX_UNLOCKED_SEASON=1)

---

**제작**: AI Agent  
**리뷰어**: @user  
**브랜치**: feat/season-lock-s1-only  
**의존성**: Docker Desktop (테스트 필요)

