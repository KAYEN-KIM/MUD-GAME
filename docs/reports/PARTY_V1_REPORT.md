# Party v1 Implementation Report

## ✅ Executive Summary

**Party v1 (join-code + sync + party EXP bonus) + QUEST_TRACK throttle map GC 완료**

- **P0 Fix**: QUEST_TRACK throttle map memory growth 해결 (disconnect cleanup + periodic eviction)
- **Server**: Party WS API (join-code 기반), party sync model, party EXP bonus (+20%)
- **Client**: Party UI (create/join/leave), PARTY_SYNC handling, real-time member updates
- **STATE_SYNC 경량 정책 유지**: Party details는 PARTY_SYNC 이벤트로만 제공

---

## 📁 Changed Files

### Server (5 files)

1. **`apps/server/src/modules/ws/ws.gateway.ts`**
   - P0 Fix: `cleanupQuestTrackThrottle()` 추가, `handleDisconnect()`에서 throttle 맵 정리
   - Party 핸들러 추가: `handlePartyCreate`, `handlePartyJoin`, `handlePartyLeave`, `handlePartyInfo`
   - `sendPartySyncToAll()` 메서드 추가 (모든 파티 멤버에게 PARTY_SYNC 푸시)
   - `handleMove()`에서 roomId 변경 시 PARTY_SYNC 푸시

2. **`apps/server/src/modules/party/party.service.ts`**
   - Join code 지원 추가: `partyCodeMap`, `characterPartyMap` (in-memory)
   - `createParty()` 수정: join code 생성 및 반환
   - `joinPartyByCode()` 추가: code 기반 파티 가입
   - `leaveParty()` 수정: 맵 정리, 리더 승계 로직
   - `getPartyCodeByPartyId()`, `getPartyIdByCharacterId()` 헬퍼 추가

3. **`apps/server/src/modules/combat/combat.service.ts`**
   - `balance.json` 로딩 추가
   - Party EXP bonus 구현: 2명 이상 + 같은 방 조건 체크
   - 보너스 적용 시 로그 출력: `[PARTY] 파티 보너스 적용: +20% EXP`

4. **`apps/server/content/balance.json`** (신규)
   - `partyExpBonusPct: 20` 설정

### Client (4 files)

1. **`mud_client/lib/core/models/party_models.dart`** (신규)
   - `PartyMember`, `PartyInfo` 모델 추가

2. **`mud_client/lib/state/session_state.dart`**
   - `_partyInfo` 상태 추가
   - `PARTY_SYNC` 핸들러 추가
   - `partyCreate()`, `partyJoin()`, `partyLeave()`, `partyInfo()` 메서드 추가
   - AUTH_OK 후 `partyInfo()` 자동 호출

3. **`mud_client/lib/features/party/party_screen.dart`** (신규)
   - Party 화면 구현: 파티 없을 때 / 파티 있을 때 두 가지 뷰
   - 초대 코드 입력, 파티 생성, 가입, 나가기 버튼
   - 파티원 목록 표시 (리더 표시, 레벨, 방 ID)

4. **`mud_client/lib/features/home/home_screen.dart`**
   - Party 버튼 추가 (AppBar)

---

## 🔌 Protocol Specification

### 1. PARTY_CREATE

**Request:**
```json
{
  "t": "PARTY_CREATE",
  "reqId": "...",
  "p": {}
}
```

**Response:** PARTY_SYNC (see below)

**Behavior:**
- 새 파티 생성 (6자리 base32 code 자동 생성)
- 요청자를 리더로 설정
- 모든 파티 멤버(생성자)에게 PARTY_SYNC 푸시

---

### 2. PARTY_JOIN

**Request:**
```json
{
  "t": "PARTY_JOIN",
  "reqId": "...",
  "p": {
    "code": "A3B5C7"
  }
}
```

**Response:** PARTY_SYNC (see below)

**Behavior:**
- Code로 파티 찾기
- 파티 인원 체크 (max=4)
- 멤버 추가
- 모든 파티 멤버에게 PARTY_SYNC 푸시

**Error Cases:**
- `유효하지 않은 초대 코드입니다.` (code not found)
- `파티가 가득 찼습니다.` (memberCount >= 4)
- `이미 파티에 속해 있습니다.` (already in party)

---

### 3. PARTY_LEAVE

**Request:**
```json
{
  "t": "PARTY_LEAVE",
  "reqId": "...",
  "p": {}
}
```

**Response:** 
- 나간 캐릭터: PARTY_SYNC (p: null)
- 남은 멤버들: PARTY_SYNC (updated party)

**Behavior:**
- 멤버 제거
- 파티가 비면 삭제
- 리더가 나갔으면 다음 멤버를 리더로 승격 (stable deterministic)

---

### 4. PARTY_INFO

**Request:**
```json
{
  "t": "PARTY_INFO",
  "reqId": "...",
  "p": {}
}
```

**Response:** PARTY_SYNC (see below)

**Behavior:**
- 현재 파티 정보 조회
- 파티 없으면 `p: null`

---

### 5. PARTY_SYNC (Server Push)

**Event:**
```json
{
  "t": "PARTY_SYNC",
  "reqId": undefined,
  "ts": 1234567890,
  "p": {
    "partyId": "uuid",
    "code": "A3B5C7",
    "leaderCharacterId": "char-id",
    "members": [
      {
        "characterId": "char-id",
        "name": "Player1",
        "level": 5,
        "roomId": "R1_00"
      }
    ],
    "ts": 1234567890
  }
}
```

**특징:**
- `reqId` 없음 (server push)
- `p: null` if no party

**전송 조건:**
1. PARTY_CREATE 성공 시
2. PARTY_JOIN 성공 시
3. PARTY_LEAVE 성공 시
4. Member MOVE (roomId 변경) 시
5. PARTY_INFO 요청 시

---

## 💰 Party EXP Bonus

### 조건

1. 캐릭터가 파티에 속해 있음
2. 파티 멤버 2명 이상
3. 최소 1명 이상의 다른 파티 멤버가 같은 `roomId`에 있음 (COMBAT_END 시점)

### 보너스

- **baseExp**: 50
- **finalExp**: `Math.floor(baseExp * (1 + partyExpBonusPct / 100))`
- **partyExpBonusPct**: 20 (balance.json)
- **결과**: 50 * 1.2 = 60 EXP

### 로그

```
[PARTY] 파티 보너스 적용: +20% EXP (50 -> 60)
```

### 제한사항

- Gold/drops unchanged (MVP scope: EXP only)
- 같은 방에 있지 않은 파티 멤버는 보너스 미적용

---

## 🔧 P0 Fix: QUEST_TRACK Throttle Map GC

### 문제

- `questTrackThrottle` Map<characterId, {lastSentAtMs, lastHash}>가 무한히 증가

### 해결

#### A. Disconnect Cleanup

```typescript
handleDisconnect(client: WSClient) {
  const clientData = this.clients.get(client);
  if (clientData?.characterId) {
    this.questTrackThrottle.delete(clientData.characterId);
  }
  this.clients.delete(client);
}
```

#### B. Periodic Eviction

```typescript
private cleanupQuestTrackThrottle(nowMs: number) {
  const EVICT_AFTER_MS = 60 * 60 * 1000; // 60분
  const toDelete: string[] = [];
  
  for (const [characterId, data] of this.questTrackThrottle.entries()) {
    if (nowMs - data.lastSentAtMs > EVICT_AFTER_MS) {
      toDelete.push(characterId);
    }
  }
  
  for (const characterId of toDelete) {
    this.questTrackThrottle.delete(characterId);
  }
  
  if (toDelete.length > 0) {
    console.log(`[QuestTrackThrottle] Evicted ${toDelete.length} stale entries`);
  }
}
```

**호출 시점:**
- `sendQuestTrack()` 내부에서 opportunistic cleanup
- 조건: `questTrackThrottle.size % 50 === 0 && size > 0`

### 효과

- Map이 무한히 증가하지 않음
- Disconnect 시 즉시 정리
- 60분 미사용 항목 자동 제거

---

## 🧪 Test Results

### Server

```bash
cd "C:\Users\Kyung\Mud Game\apps\server"
pnpm smoke
```

**결과:** ✅ 16/16 PASS (기존 유지)

**추가 확인:**
- QUEST_TRACK throttle 맵 GC 동작 확인 (disconnect 시 삭제)
- Party EXP bonus 로그 확인 (2명 이상 같은 방에서 HUNT 시)

### Client

```bash
cd "C:\Users\Kyung\Mud Game\mud_client"
flutter analyze
dart format .
```

**결과:**
- ✅ `flutter analyze`: 0 warnings
- ✅ `dart format`: 통과
- ✅ 앱 실행: 정상 (파티 화면 동작)

### Manual Test

#### 1. Party Create/Join

**시나리오:**
1. Client A: 로그인 → Party 화면 → "파티 생성"
2. 초대 코드 확인 (예: `A3B5C7`)
3. Client B: 로그인 → Party 화면 → 코드 입력 → "가입"
4. 두 클라이언트 모두 PARTY_SYNC 수신 → 파티원 2명 표시

**확인 사항:**
- [x] 파티 생성 성공
- [x] 초대 코드 표시
- [x] 가입 성공
- [x] 두 클라이언트 모두 파티 정보 동기화

#### 2. Party Sync on MOVE

**시나리오:**
1. Client A: R1_00으로 이동
2. Client B: 파티 화면에서 A의 roomId가 R1_00으로 변경됨 확인

**확인 사항:**
- [x] MOVE 시 PARTY_SYNC 푸시
- [x] 다른 멤버 화면에서 roomId 업데이트

#### 3. Party EXP Bonus

**시나리오:**
1. Client A, B 모두 R1_00으로 이동
2. Client A: HUNT
3. COMBAT_END 로그 확인: EXP 60 (50 + 20%)
4. 서버 로그 확인: `[PARTY] 파티 보너스 적용: +20% EXP (50 -> 60)`

**확인 사항:**
- [x] 같은 방에서 2명 이상 → EXP 보너스 적용
- [x] 로그에 보너스 표시

#### 4. Party Leave

**시나리오:**
1. Client B: "파티 나가기" 클릭
2. Client A: 파티원 1명으로 감소 확인
3. Client B: 파티 화면에 "파티가 없습니다" 표시

**확인 사항:**
- [x] 나가기 성공
- [x] PARTY_SYNC 푸시 (남은 멤버)
- [x] 나간 멤버에게 `p: null` PARTY_SYNC

---

## ✅ STATE_SYNC Lean Policy Maintained

**확인 사항:**
- ✅ STATE_SYNC payload에 party 정보 추가 없음
- ✅ Party details는 PARTY_SYNC 이벤트로만 제공
- ✅ PARTY_SYNC는 필요할 때만 푸시 (create/join/leave/move)
- ✅ STATE_SYNC 구조 변경 없음

**STATE_SYNC 구조 (변경 없음):**
```json
{
  "t": "STATE_SYNC",
  "p": {
    "char": { "id", "name", "level", "hp", "hpMax", "gold", "roomId", "roomTags" },
    "exits": [...],
    "equipment": {...},
    "inventory": [...]
  }
}
```

---

## 📊 Quality Gates

### Server
- ✅ `pnpm smoke`: 16/16 PASS
- ✅ TypeScript 컴파일: 통과
- ✅ 린트: 통과

### Client
- ✅ `dart format .`: 통과
- ✅ `flutter analyze`: 0 warnings
- ✅ 앱 실행 시 크래시 없음
- ✅ STATE_SYNC 경량 정책 유지

---

## 🚧 Known Limitations / Follow-ups

### Known Limitations

1. **In-memory Party Storage**
   - `partyCodeMap`, `characterPartyMap`은 in-memory
   - 서버 재시작 시 파티 정보 소실
   - 미래: Prisma Party 테이블 활용 또는 Redis 영속화

2. **Party Code Collision**
   - 6자리 base32 code (32^6 = 1,073,741,824 조합)
   - Collision 체크 없음 (MVP scope)
   - 미래: Code 중복 체크 추가

3. **Party Size Fixed**
   - Max 4명 (하드코딩)
   - 미래: balance.json에서 설정 가능하도록

4. **Party EXP Bonus: EXP Only**
   - Gold/drops 보너스 미포함 (MVP scope)
   - 미래: Gold/drop bonus 추가

5. **No Party Chat**
   - 파티 전용 채팅 미구현
   - 미래: PARTY_CHAT 이벤트 추가

### Follow-ups (NOT in this PR)

1. **Boss Spawn/Cooldown + Boss Room Tags**
   - PR-08로 별도 구현

2. **Quest UI: Party/Boss Progress**
   - Mini tracker에 파티 보스 진행도 표시

3. **Party Invitation System**
   - 현재 code 기반만 지원
   - 미래: 캐릭터 이름 기반 초대

4. **Party Settings**
   - Speed mode (FAST/TACTICAL) UI
   - Auto preset UI

5. **Party Buff/Debuff System**
   - 파티 스킬/버프 시스템

---

## 🎉 Conclusion

**Party v1 (join-code + sync + party EXP bonus) + P0 Fix 완료**

- ✅ P0 Fix: QUEST_TRACK throttle map memory growth 해결
- ✅ Server: Party WS API (join-code 기반), party sync model, party EXP bonus (+20%)
- ✅ Client: Party UI (create/join/leave), PARTY_SYNC handling, real-time member updates
- ✅ STATE_SYNC 경량 정책 유지 (party details는 PARTY_SYNC로만)
- ✅ 품질 게이트 통과 (smoke 16/16, flutter analyze 0 warnings)
- ✅ 수동 테스트 완료 (create/join/move sync/exp bonus/leave)

**핵심 개선:**
- **Join Code 기반 파티**: 초대 코드로 간편한 파티 가입
- **Real-time Sync**: MOVE 시 자동 PARTY_SYNC (roomId 업데이트)
- **EXP Bonus**: 파티 플레이 인센티브 (+20% EXP)
- **메모리 누수 방지**: QUEST_TRACK throttle map GC

**다음 단계:**
- Boss spawn/cooldown (PR-08)
- Quest UI: party/boss progress
- Party invitation system
- Party chat

---

**작성일:** 2025-12-17  
**작성자:** Cursor Agent  
**Branch:** `feat/party-v1`  
**Smoke:** ✅ 16/16 PASS  
**Flutter Analyze:** ✅ 0 warnings

