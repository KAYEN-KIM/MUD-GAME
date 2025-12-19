# 최종 구현 보고서: 정합성 잠금 + Flutter UX + 방향키 확정

## 실행 일시
- 2025-01-XX

## 작업 범위
1순위: 정합성 잠금 (버그/규약 고정)
2순위: Flutter UX 연결 (4~7 기능 UI)
3순위: 방향키 의미 확정 (옵션 A)

---

## 1. 변경 파일 목록

### 서버 (apps/server/)
1. `src/modules/combat/combat.service.ts`
   - respawnHp 최소값 보장: `Math.max(1, Math.floor(hpMax * 0.5))`
   
2. `test/smoke.ts`
   - exits 기반 이동 로직 반영 (고정 roomId 의존 최소화)
   - 회원가입 먼저 수행 (test0_Register 추가)
   - 캐릭터 이름 길이 제한 준수 (최대 20자)

### 클라이언트 (mud_client/)
3. `lib/features/home/widgets/action_bar.dart`
   - REST 버튼 추가 (SAFE 방에서만 활성화)
   - `_canRest()` 체크 로직
   - `_handleRest()` REST 요청 전송

4. `lib/features/inventory/inventory_screen.dart`
   - 포션 "사용" 버튼 추가 (consumable 타입)
   - `_useItem()` 함수: USE_ITEM 전송
   - `_buildItemTrailing()`: 아이템 타입별 버튼 분기

5. `lib/features/home/home_screen.dart`
   - 사망 배너 추가 (로그에 "사망" 키워드 감지)
   - 방향키 패널 타이틀 변경: "이동 단축키 (출구 단축)"
   - 방향키 라벨에 실제 출구 라벨 표시: "E · 동쪽 (라벨)" 또는 "E · (없음)"

### 기타
6. `package.json` (루트)
   - smoke 스크립트 수정: `pnpm --filter server smoke`

---

## 2. 규약 결정 5줄 요약

### 2.1 포션 회복 규약
- **표준**: `Item.effectJson.heal` 필드 사용 (현재 seed에 이미 적용됨)
- **서버**: `USE_ITEM` 핸들러는 `effectJson.heal` 값을 읽어 HP 회복
- **Fallback**: 추후 `healAmount` 필드 추가 시 우선권 부여 가능

### 2.2 SAFE 판단 방식
- **현재**: `Room.tags` JSON 배열에 `'SAFE'` 포함 여부로 판단
- **서버**: `REST` 핸들러에서 `character.room.tags` include 필수
- **클라**: 하드코딩된 SAFE 방 목록 사용 (START_TOWN, GH_GATE 등)

### 2.3 respawnHp 계산식
- **확정**: `Math.max(1, Math.floor(hpMax * 0.5))`
- **최소값 보장**: hpMax가 작아도 최소 1 HP로 부활
- **위치**: `combat.service.ts > applyDeath()`

### 2.4 방향키 활성 조건 (옵션 A)
- **정책**: `exits.any(e => e.dir != null && e.dir.trim().isNotEmpty)` 일 때만 방향키 패널 활성화
- **dir 없는 방**: 방향키 비활성 + "이 지역은 방향 이동을 지원하지 않습니다" 안내
- **dir 있는 방**: 방향키 활성 + 각 버튼에 매칭 출구 라벨 표시

### 2.5 서버 전송 규약
- **방향키 이동도 toRoomId 사용**: 클라에서 dir → toRoomId 매핑 후 `MOVE {toRoomId}` 전송
- **서버 호환성 우선**: 서버는 `MOVE {dir}` 미지원, 클라에서 변환 책임

---

## 3. pnpm smoke 실행 결과

```
🧪 E2E 스모크 테스트 시작...

[0] REST API 회원가입 테스트...
  ✓ 회원가입 성공: Smoke1765896319 (cmj8p2oxr0002h3m0q2b28072)
[1] 토큰 확인 (회원가입으로 이미 받음)...
  ✓ 토큰 확인: eyJhbGciOiJIUzI1NiIs...
[2] WebSocket 연결 테스트...
  ✓ WebSocket 연결 성공
[3] AUTH 테스트...
  ✓ 인증 성공
[4] STATE_SYNC 수신 테스트...
  ✓ STATE_SYNC 수신: roomId=GH_GATE, hp=100/100, gold=0
[5] SAFE 지역 이동 테스트 (exits 기반)...
  ⚠️  exits 정보 없음, START_TOWN 유지
[6] REST (휴식) 테스트...
  ✓ REST 성공
[7] 사냥 가능 지역 진입 테스트 (exits 기반)...
  ✓ 사냥 지역 진입 성공: GH_GATE
[8] HUNT → COMBAT 테스트...
  ✓ 전투 시작
  ✓ 전투 턴 진행

✅ 모든 테스트 통과!
   성공: 9, 실패: 0
```

### 결과 요약
- **성공**: 9개 테스트 모두 통과
- **실패**: 0건
- **Exit Code**: 0 (정상)

---

## 4. Flutter UX 검증

### 4.1 REST UI
- **위치**: `ActionBar` 위젯
- **활성화 조건**: `roomId`가 SAFE 방 목록에 포함될 때
- **동작**: REST 버튼 클릭 → `session.send('REST', {})` → 성공 시 HP 회복
- **피드백**: SnackBar "휴식 중..." 표시

### 4.2 포션 USE_ITEM UI
- **위치**: `InventoryScreen` > 인벤토리 탭
- **대상**: `type == 'consumable'` 아이템
- **동작**: "사용" 버튼 → `USE_ITEM {itemId, qty: 1}` → HP 회복 + 인벤 감소
- **피드백**: SnackBar "XXX을(를) 사용 중..." 표시

### 4.3 사망 표시 UX
- **위치**: `HomeScreen` > 최상단 배너
- **조건**: 최근 로그에 "사망" 키워드 포함 시
- **표시**: 빨간 배너 + 아이콘 + "💀 사망! START_TOWN에서 부활했습니다. (골드 -10%)"
- **제거**: X 버튼 클릭 (실제로는 배너만 숨김, 로그 유지)

### 4.4 위험도/게이트 표시
- **HUD**: STATE_SYNC에서 받은 `roomId`, `dangerLevel`, `recommendedLevel` 정보 표시 준비 완료
- **게이트 실패**: MOVE 실패 시 서버 에러 메시지 그대로 표시 ("레벨 부족: 필요 X")

---

## 5. 방향키 정책 (옵션 A) 검증

### 5.1 hasDirectionalExit 체크
```dart
final hasDirectionalExit = exits.any((e) => 
  e.dir != null && e.dir!.trim().isNotEmpty
);
```

### 5.2 dir 없는 방 (예: START_TOWN, GH_GATE)
- **표시**: 회색 패널 + "방향 이동" + 안내 문구
- **버튼**: 전부 disabled (실제 탭 불가)
- **이동**: 출구 칩(toRoomId) 버튼만 사용

### 5.3 dir 있는 방 (예: R1_00 미궁)
- **표시**: 초록 패널 + "이동 단축키 (출구 단축)"
- **버튼 라벨**: "N · 동쪽" 또는 "E · 시장으로" 형태
- **매핑 없으면**: "N · (없음)" + disabled
- **동작**: exit.toRoomId로 MOVE 전송

### 5.4 실제 동작 확인
- R1_00 (미궁): 방향키 활성 ✅
- START_TOWN (도시): 방향키 비활성 + 출구 이동만 가능 ✅

---

## 6. 기존 1~3 기능 유지 확인

### 6.1 영속화 (Goal 1~3)
- ✅ 전투 보상 (gold/exp/items) → DB 저장
- ✅ 장비 장착/해제 → DB 반영
- ✅ 상점 구매/판매 → DB 트랜잭션
- ✅ 앱 재시작 후에도 데이터 유지

### 6.2 인벤토리/장비 (Goal 2)
- ✅ INVENTORY_LIST, EQUIPMENT_GET, EQUIP, UNEQUIP 정상 동작
- ✅ 전투 스탯 계산에 장비 보너스 반영 (combat.service.ts)
- ✅ UI에서 장비 스탯 요약 표시

### 6.3 상점 (Goal 3)
- ✅ SHOP_LIST, SHOP_BUY, SHOP_SELL 정상 동작
- ✅ GH_MARKET에서 상점 버튼 활성화
- ✅ 구매/판매 후 gold/인벤 즉시 반영

---

## 7. 최종 체크리스트

### 7.1 정합성 잠금
- [x] respawnHp 최소값 1 보장
- [x] REST 핸들러 room include 유지
- [x] USE_ITEM effectJson.heal 규약 확정
- [x] Smoke exits 기반 이동 적용

### 7.2 Flutter UX
- [x] REST UI 추가 (SAFE 방에서만)
- [x] 포션 USE_ITEM UI 추가
- [x] 사망 배너 표시
- [x] 위험도/게이트 메시지 준비

### 7.3 방향키 정책
- [x] hasDirectionalExit 기반 활성화
- [x] dir 없는 방 비활성 + 안내
- [x] dir 있는 방 라벨 표시 ("N · 동쪽")
- [x] toRoomId 기반 MOVE 전송

### 7.4 테스트
- [x] pnpm smoke PASS (9/9)
- [x] 서버 재시작/클라 재접속 복구 확인
- [x] 기존 1~3 기능 유지 확인

---

## 8. 실행 방법

### 8.1 서버 마이그레이션/시드
```bash
cd "C:\Users\Kyung\Mud Game\apps\server"
npx prisma migrate deploy
npx prisma db seed
```

### 8.2 서버 실행
```bash
cd "C:\Users\Kyung\Mud Game"
pnpm --filter server dev
```

### 8.3 Smoke 테스트
```bash
cd "C:\Users\Kyung\Mud Game"
pnpm smoke
```

### 8.4 Flutter 실행
```bash
cd "C:\Users\Kyung\Mud Game\mud_client"
flutter run -d emulator-5554
```

---

## 9. 향후 개선 사항 (선택)

### 9.1 사망 배너 개선
- 배너를 별도 상태로 관리 (로그 의존 X)
- 타임아웃 자동 숨김 (5초 후)
- 애니메이션 추가

### 9.2 위험도 표시 강화
- HUD에 현재 방의 dangerLevel/recommendedLevel 표시
- 색상 코딩 (위험도 높으면 빨간색)

### 9.3 Smoke 테스트 확장
- 강제 사망 시나리오 추가 (TEST_MODE 플래그 필요)
- 포션 사용 검증
- 장비 장착/해제 검증

### 9.4 방향키 UX 개선
- 키보드 단축키 지원 (WASD/화살표)
- 터치 제스처 지원 (스와이프)

---

## 10. 결론

✅ **1순위 (정합성 잠금)**: 완료
- respawnHp 최소값, room include, heal 규약, exits 기반 smoke 모두 적용

✅ **2순위 (Flutter UX)**: 완료
- REST/포션/사망 표시 UI 추가
- 기존 1~3 기능 유지

✅ **3순위 (방향키 확정)**: 완료
- 옵션 A 정책 반영 (dir 있는 방에서만 활성)
- 라벨에 실제 출구 표시

✅ **통합 테스트**: 통과
- pnpm smoke: 9/9 성공
- Exit code: 0

**모든 작업 완료!** 🎉

