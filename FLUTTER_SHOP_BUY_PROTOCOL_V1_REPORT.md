# Flutter Shop Buy Protocol V1

## 📋 변경 요약

**문제**: 기존 상점 구매 플로우가 `STATE_SYNC` 대기 방식으로 동작하여 사용자 피드백이 느리고 예측 불가능했습니다.

**해결**: 
- `SHOP_BUY_OK` / `SHOP_BUY_ERR`을 즉시 처리하는 프로토콜로 전환
- `reqId` 기반 요청-응답 매칭으로 중복 클릭 방지 및 타임아웃 처리
- 구매 성공 시 재화/인벤토리를 즉시 반영하고, 이후 `STATE_SYNC`로 최종 정합성 보장
- 에러 코드별 사용자 친화적 메시지 제공

**핵심 원칙**:
- `SHOP_BUY_OK/ERR`: 즉시 UX (로컬 상태 즉시 갱신)
- `STATE_SYNC`: 최종 권위 (서버 스냅샷으로 덮어쓰기)

---

## 📁 변경 파일 목록

### 신규 파일
1. **`mud_client/lib/core/request_tracker.dart`** (새로 작성)
   - `RequestTracker`: reqId 기반 요청-응답 매칭 유틸리티
   - `ShopBuyError`: 상점 구매 실패 에러 클래스
   - `ShopBuyResult`: 상점 구매 성공 결과 클래스
   - 타임아웃 자동 처리 (기본 10초)
   - 중복 요청 방지

### 수정 파일
2. **`mud_client/lib/state/session_state.dart`** (핵심 변경)
   - `RequestTracker` 인스턴스 추가 (`_requestTracker`)
   - `SHOP_BUY_OK` 메시지 핸들러 추가:
     - `ShopBuyResult` 파싱
     - `balances`로 gold 즉시 반영
     - `granted`로 인벤토리 아이템 추가
     - `cost`로 차감된 아이템 반영 (인장/트로피 등)
     - reqId로 pending 요청 완료
   - `SHOP_BUY_ERR` 메시지 핸들러 추가:
     - `ShopBuyError` 생성 및 reqId로 에러 완료
   - `sendWithReqId()`: reqId 생성하여 전송하는 헬퍼
   - `shopBuy()`: 기존 fire-and-forget → Future 반환으로 변경
   - `_addInventoryItem()` / `_subtractInventoryItem()`: 인벤토리 로컬 조작 헬퍼

3. **`mud_client/lib/features/shop/shop_screen.dart`** (UX 개선)
   - `_buyItem()`: async/await 기반으로 완전 재작성
   - 구매 중 중복 클릭 방지 (`_buyingItems` 가드)
   - 성공 시: 녹색 SnackBar "✅ [아이템명] 구매 완료!"
   - 실패 시: 빨간색 SnackBar + 에러 코드별 사용자 친화적 메시지
   - kDebugMode에서만 디버그 로그 출력

---

## 🔧 프로토콜 스펙

### SHOP_BUY_OK

**서버 → 클라이언트**

```json
{
  "t": "SHOP_BUY_OK",
  "reqId": "req_1234567890_12345",
  "ts": 1700000000000,
  "p": {
    "itemId": "ITEM_ICON_BOSS_S1_RESIDUE_BROKER",
    "qty": 1,
    "cost": {
      "ITEM_TROPHY_BOSS_S1_RESIDUE_BROKER": 2
    },
    "balances": {
      "gold": 5000,
      "ITEM_LEDGER_SEAL_S1": 10,
      "ITEM_TROPHY_BOSS_S1_RESIDUE_BROKER": 1
    }
  }
}
```

**필드 설명**:
- `itemId`: 구매한 아이템 ID
- `qty`: 구매 수량
- `cost`: 차감된 재화 (gold 제외, 아이템 화폐만)
- `balances`: 구매 후 잔액 (gold + 특수 재화)

### SHOP_BUY_ERR

**서버 → 클라이언트**

```json
{
  "t": "SHOP_BUY_ERR",
  "reqId": "req_1234567890_12345",
  "ts": 1700000000000,
  "p": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "골드가 부족합니다.",
    "itemId": "ITEM_POTION_HP_L"
  }
}
```

**에러 코드**:
| Code | 사용자 메시지 |
|------|--------------|
| `INSUFFICIENT_FUNDS` / `INSUFFICIENT_GOLD` | 골드가 부족합니다. |
| `INSUFFICIENT_ITEM` / `INSUFFICIENT_COST` | 필요한 재화가 부족합니다. |
| `NOT_FOUND` / `SHOP_NOT_FOUND` / `ITEM_NOT_FOUND` | 상점 또는 아이템을 찾을 수 없습니다.<br>(콘텐츠 업데이트 필요) |
| `RATE_LIMIT` | 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요. |
| `INVALID_REQ` / `INVALID_REQUEST` | 잘못된 요청입니다. |
| `CHARACTER_BUSY` | 다른 작업을 진행 중입니다. |

---

## 🧪 수동 테스트 시나리오

### 준비
1. Flutter 앱 실행: `cd mud_client && flutter run`
2. 로그인 후 `GH_LEDGER_OFFICE`로 이동
3. Shop 탭 진입

### 시나리오 1: 구매 성공 (충분한 재화)

**전제**: DEBUG_GRANT_ITEM으로 인장 5개 지급
```
DEBUG_GRANT_ITEM ITEM_LEDGER_SEAL_S1 5
```

**단계**:
1. `SHOP_S1_LEDGER_EXCHANGE`에서 아이템 선택 (예: 인장 → 스탬프 교환)
2. "구매" 버튼 클릭
3. 확인 다이얼로그에서 "구매" 클릭

**예상 결과**:
- 로딩 인디케이터 표시 (버튼이 Circular Progress로 변경)
- 1~2초 내 녹색 SnackBar: "✅ [아이템명] 구매 완료!"
- 인장 수량 즉시 감소 (5 → 4)
- 구매한 아이템 즉시 인벤토리에 추가
- 골드 표시 즉시 갱신 (해당되는 경우)

### 시나리오 2: 구매 실패 (부족한 재화)

**전제**: 인장 0개 상태

**단계**:
1. 인장이 필요한 아이템 선택
2. "구매" 버튼 클릭 (이미 비활성화되어 있어야 함)
3. (강제로 활성화했다면) 확인 후 클릭

**예상 결과**:
- 빨간색 SnackBar: "❌ 필요한 재화가 부족합니다."
- 인벤토리/재화 변경 없음
- 로딩 즉시 해제

### 시나리오 3: 중복 클릭 방지

**단계**:
1. "구매" 버튼 클릭
2. 응답 대기 중에 버튼 다시 클릭 시도

**예상 결과**:
- 두 번째 클릭 무시됨 (로딩 중이면 버튼 비활성)
- 서버로 중복 요청 전송 안 됨

### 시나리오 4: 타임아웃

**전제**: 서버 응답 지연/미응답 시뮬레이션 (서버 종료)

**예상 결과**:
- 10초 후 타임아웃
- 에러 SnackBar 표시
- 로딩 자동 해제

### 시나리오 5: 앱 재시작 후 정합성

**단계**:
1. 구매 완료
2. 앱 재시작 (Flutter hot restart)
3. 재로그인

**예상 결과**:
- STATE_SYNC로 서버 권위 데이터 수신
- 재화/인벤토리가 서버 데이터와 일치

---

## 🎯 품질 게이트 결과

### Flutter Analyze
```bash
cd mud_client
flutter analyze
```

**결과**: ✅ 새 이슈 0 (Cursor linter 통과)

### Dart Format
```bash
dart format lib/core/request_tracker.dart lib/state/session_state.dart lib/features/shop/shop_screen.dart
```

**결과**: ✅ 포맷팅 완료

### 서버 변경
**결과**: ✅ 변경 없음 (서버는 이미 SHOP_BUY_OK/ERR, reqId echo 지원)

---

## ⚠️ 알려진 이슈 & 제약

### 현재 구현
- ✅ 단일 구매 (qty=1 고정)
- ✅ 골드 상점 지원
- ✅ 아이템 화폐 상점 (인장/트로피) 지원
- ✅ 에러 코드별 사용자 메시지
- ✅ 중복 클릭 방지
- ✅ 타임아웃 자동 처리

### 미래 과제
1. **수량 구매 (qty > 1)**: UI에 qty 입력 필드 추가 필요
2. **구매 히스토리**: 감사 로그 UI (Admin 도구에서 먼저 구현 권장)
3. **에러 코드 표준화**: 서버와 클라 간 에러 코드 사전 동기화
4. **재고 제한**: 서버가 재고 시스템 도입 시 UI에 "재고 부족" 표시 추가
5. **구매 애니메이션**: 구매 성공 시 시각 효과 (선택 사항)

---

## 🚀 배포 전 체크리스트

- [x] `RequestTracker` 유틸 구현
- [x] `SessionState`에 SHOP_BUY_OK/ERR 핸들러 추가
- [x] `ShopScreen` 구매 플로우 OK/ERR 기반으로 교체
- [x] Linter 통과 (새 이슈 0)
- [ ] 수동 테스트 5개 시나리오 실행 (사용자 직접 수행 필요)
- [ ] 앱 재시작 후 정합성 확인
- [ ] 서버 smoke 테스트 유지 (서버 변경 없음)

---

## 📝 PR 범위

### In Scope
- Flutter 클라이언트만 변경
- SHOP_BUY 프로토콜 개선 (OK/ERR 즉시 처리)
- reqId 기반 요청-응답 매칭
- 사용자 친화적 에러 메시지
- 중복 클릭 방지 및 타임아웃 처리

### Out of Scope
- 서버 프로토콜 변경 (이미 지원됨)
- 수량 구매 (qty > 1)
- 구매 히스토리 UI
- 다른 화면 (home, quest, inventory) 구조 변경

---

**작성일**: 2025-12-19  
**브랜치**: `feat/flutter-shopbuy-protocol-v1`  
**작성자**: AI Assistant (Claude Sonnet 4.5)

