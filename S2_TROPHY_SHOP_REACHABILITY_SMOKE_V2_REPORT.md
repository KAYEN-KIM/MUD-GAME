# S2 Trophy Exchange Reachability Fix + Smoke UN-SKIP Report

**날짜**: 2025-12-19  
**작업**: S2 트로피 교환소 위치 이동 + Smoke 테스트 SHOP_BUY UN-SKIP  
**목표**: "1 room = 1 shop" 가정 복원 + S2 E2E smoke 완전 통과  
**브랜치**: feat/s2-trophyshop-smoke-unskip-v1

---

## 요약

- **문제**: GH_LEDGER_OFFICE에 3개 상점(S1 ledger exchange / S1 boss trophy / S2 boss trophy)이 공존하여 ShopService의 "1 room = 1 shop" 가정이 깨짐 → S2 smoke SKIP 발생
- **해결**: S2 트로피 교환소를 **R2_00 (연무의 도서 입구)** 로 이동하여 물리적 분리
- **결과**: S2 교환소가 S2 허브에 위치하게 되어 상점 분기 문제 해결, smoke 테스트 UN-SKIP 가능

---

## 변경 사항

### 1. `apps/server/content/shops.json`

**변경**: SHOP_S2_BOSS_TROPHY_EXCHANGE의 roomId 변경

```json
{
  "id": "SHOP_S2_BOSS_TROPHY_EXCHANGE",
  "roomId": "R2_00",  // GH_LEDGER_OFFICE → R2_00
  "title": "보스 트로피 교환소 (S2)",
  "items": [
    {
      "itemId": "ITEM_ICON_BOSS_S02",
      "priceGold": 0,
      "costItems": [{"itemId": "ITEM_TROPHY_BOSS_S02", "qty": 2}]
    },
    {
      "itemId": "ITEM_TITLE_BOSS_S02",
      "priceGold": 0,
      "costItems": [{"itemId": "ITEM_TROPHY_BOSS_S02", "qty": 3}]
    }
  ]
}
```

**영향**:
- GH_LEDGER_OFFICE: S1 상점 2개만 남음 (ledger exchange + S1 boss trophy)
- R2_00: S2 상점 1개만 존재 → "1 room = 1 shop" 가정 복원

---

### 2. `apps/server/test/smoke.ts`

#### 변경 A: test16_S2VerticalSlice() 완전 재작성

**Before**: S2 교환소 테스트 SKIP (GH_LEDGER_OFFICE에서 분기 실패)

**After**: R2_00에서 SHOP_BUY 실제 실행 및 검증

```typescript
// test16_S2VerticalSlice()
// D) R2_00에서 S2 트로피 교환소 SHOP_LIST 확인
const shopReqId = this.send('SHOP_LIST', {});
const shopList = await this.waitForMessage('SHOP_LIST', 5000, shopReqId);
if (shopList.p.shopId !== 'SHOP_S2_BOSS_TROPHY_EXCHANGE') {
  throw new Error(`R2_00 상점 ID 불일치`);
}

// E) ITEM_ICON_BOSS_S02 구매 (트로피 2개 필요)
const buyReqId = this.send('SHOP_BUY', { itemId: 'ITEM_ICON_BOSS_S02' });
const buyOk = await this.waitForMessage('SHOP_BUY_OK', 5000, buyReqId);
if (!buyOk) throw new Error('SHOP_BUY_OK 수신 실패');

// F) 인벤토리 검증: ITEM_ICON_BOSS_S02 존재 확인
```

**검증 항목**:
1. SHOP_LIST가 SHOP_S2_BOSS_TROPHY_EXCHANGE 반환
2. SHOP_BUY 성공 (SHOP_BUY_OK 수신)
3. 인벤토리에 ITEM_ICON_BOSS_S02 존재
4. 트로피 차감 (3 → 1)

#### 변경 B: test15_SeasonShop()에서 S2 중복 로직 제거

**Before**: GH_LEDGER_OFFICE에서 S2 아이템 찾기 시도 (SKIP 발생)

**After**: S2 트로피 지급만 유지, 실제 교환은 test16에서 담당

---

### 3. `package.json` (루트)

**변경**: 한글 인코딩 깨짐 수정

```json
{
  "description": "턴제 텍스트 MUD 게임"  // "?��?지 ?�스??MUD 게임" → 수정
}
```

**이유**: Node.js 패키지 설정 오류 방지 (ERR_INVALID_PACKAGE_CONFIG)

---

## 테스트 결과

### 1. content:validate

```bash
pnpm content:validate
```

**결과**: ✅ PASS (11/11)

```
[validate_content] Deep scanning shops.json for roomId references...
[validate_content]   ✓ All roomId references valid in shops.json
[validate_content] ✅ VALIDATION PASSED
```

**확인**: R2_00이 rooms.json에 존재하며 shops.json의 roomId 참조가 유효함

---

### 2. catalog:sync

```bash
pnpm catalog:sync
```

**결과**: ✅ PASS

```
[generate_items_catalog] ✓ Generated catalog: mud_client\assets\catalog\items_catalog.json
[generate_items_catalog] ✓ Total items: 61
```

**확인**: 아이템 카탈로그 갱신 완료

---

### 3. prisma:seed (Docker 필요)

**명령**:
```bash
cd infra
docker compose up -d

cd ../apps/server
pnpm prisma:seed
```

**상태**: ⚠️ **미실행** (Docker Desktop 미실행 상태)

**예상 결과**:
- shops 테이블에 SHOP_S2_BOSS_TROPHY_EXCHANGE가 roomId='R2_00'로 저장됨
- R2_00에서 SHOP_LIST 호출 시 S2 교환소 반환

---

### 4. smoke 테스트 (Docker + seed 필요)

**명령**:
```bash
cd apps/server
$env:TEST_MODE="true"  # Windows PowerShell
# TEST_MODE=true         # Linux/Mac
pnpm smoke
```

**상태**: ⚠️ **미실행** (Docker Desktop 미실행 상태)

**예상 결과**:
```
[15] S2 Vertical Slice E2E 테스트...
  - [16.4] R2_00 S2 트로피 교환소 확인
  ✓ S2 교환소 확인: 보스 트로피 교환소 (S2), 아이템 2개
  - [16.5] SHOP_BUY (ITEM_ICON_BOSS_S02)
  ✓ 목표 아이템 확인: ITEM_ICON_BOSS_S02
  ✓ 구매 완료: ITEM_ICON_BOSS_S02 x1
  - [16.6] 인벤토리 최종 검증
  ✓ 아이콘 확인: ITEM_ICON_BOSS_S02 x1
  ✓ 트로피 차감 확인: 3 → 1
[15] S2 Vertical Slice E2E 테스트 완료!

✅ 모든 테스트 통과!
   성공: 17, 실패: 0
```

**이전 SKIP 해결**: `⚠️ S2 아이템(ITEM_ICON_BOSS_S02)이 상점에 없습니다. 시즌 분기 문제일 수 있습니다. SKIP` → **제거됨**

---

## 리스크 및 한계

### 1. S2 교환소 위치 변경 (의도된 단순화)

**Before**: GH_LEDGER_OFFICE (도시 중앙)  
**After**: R2_00 (S2 허브, 연무의 도서 입구)

**의미**:
- S2 트로피를 교환하려면 S2 맵(R2)에 진입해야 함
- 도시에서 일괄 교환은 불가 (S1 vs S2 분리)

**장점**:
- "1 room = 1 shop" 가정 유지 → ShopService 리팩토링 불필요
- 맵 진입 진입점에서 교환 가능 → UX 상 자연스러움 (보스 처치 후 바로 교환)

**단점**:
- 장기적으로는 "Trophy Hall (중앙 교환소)" 설계 고려 필요
- 현재는 MVP 단순화로 허용

---

### 2. 프로토콜 변경 없음

**확인 사항**:
- ✅ WS 메시지 타입/페이로드 불변
- ✅ DB 스키마 불변
- ✅ Flutter 파일 손대지 않음
- ✅ ShopService 로직 불변 (roomId 기반)

**영향**:
- **Flutter 클라이언트 재빌드 불필요**
- **WS 프로토콜 하위호환 유지**
- **충돌 리스크 최소화**

---

### 3. 상점 분기 문제 근본 해결 아님

**현재 상태**:
- GH_LEDGER_OFFICE: 2개 상점 (S1 ledger + S1 boss)
- R2_00: 1개 상점 (S2 boss)

**여전히 남은 문제**:
- GH_LEDGER_OFFICE에 2개 상점이 있으므로 "1 room = 1 shop" 가정이 완전히 복원된 것은 아님
- ShopService.listShop(roomId)는 첫 번째 상점만 반환 (S1 ledger exchange)
- S1 boss trophy 교환소는 **접근 불가** 상태

**해결 필요**:
- 장기적으로는 ShopService 리팩토링 (복수 상점 지원)
- 또는 S1 boss trophy 교환소도 별도 방으로 이동 (예: R1_BOSS_WARDEN 등)

**현재 PR 범위**:
- S2 교환소만 이동하여 **S2 smoke UN-SKIP**에 집중
- S1 boss trophy 문제는 별도 PR로 연기

---

## 실행 체크리스트

### 사용자 액션 필요

1. **Docker Desktop 시작**
   ```bash
   # Docker Desktop 앱 실행 (Windows/Mac)
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

4. **Smoke 테스트 실행**
   ```bash
   $env:TEST_MODE="true"
   pnpm smoke
   ```

### 예상 결과

- ✅ **17/17 PASS** (0 실패)
- ✅ **test16 S2 SHOP_BUY 성공** (SKIP 제거)
- ✅ **인벤토리 검증 통과** (ITEM_ICON_BOSS_S02 확인)

---

## 결론

- ✅ **S2 트로피 교환소 위치 이동** (GH_LEDGER_OFFICE → R2_00)
- ✅ **content:validate PASS** (roomId 참조 유효)
- ✅ **catalog:sync PASS** (아이템 카탈로그 갱신)
- ✅ **smoke.ts test16 UN-SKIP** (SHOP_BUY 실제 실행)
- ✅ **프로토콜 변경 없음** (Flutter 영향 0)
- ✅ **충돌 리스크 최소화** (content 변경만)

### 회귀 방지 효과

- S2 교환소 위치 변경 감지 (smoke 테스트 실패)
- S2 트로피 교환 로직 손상 감지 (SHOP_BUY_OK 수신 실패)
- R2_00 상점 설정 누락 감지 (shopId 불일치)

---

**제작**: AI Agent  
**리뷰어**: @user  
**브랜치**: feat/s2-trophyshop-smoke-unskip-v1  
**의존성**: Docker Desktop (실행 필요)

