# WebSocket 스모크 테스트

MUD 게임 WebSocket API 테스트 문서

## 사전 준비

1. 서버 실행:
```bash
pnpm --filter server dev
```

2. 서버 주소:
- REST: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

## 1. 회원가입 & 로그인

### 회원가입

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "characterName": "TestHero"
  }'
```

응답:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "character": {
    "id": "clxxx",
    "name": "TestHero"
  }
}
```

### 로그인

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**토큰을 저장하세요!** 이후 WebSocket 연결에 사용됩니다.

## 2. WebSocket 연결 & 인증

WebSocket 클라이언트를 사용하여 `ws://localhost:3000`에 연결합니다.

### AUTH 이벤트

```json
{
  "t": "AUTH",
  "reqId": "req1",
  "ts": 1234567890000,
  "p": {
    "token": "YOUR_JWT_TOKEN_HERE"
  }
}
```

응답 (AUTH_OK):
```json
{
  "t": "AUTH_OK",
  "reqId": "req1",
  "ts": 1234567890000,
  "p": {
    "characterId": "clxxx",
    "characterName": "TestHero"
  }
}
```

이후 `STATE_SYNC`와 `LOG_APPEND` 푸시 메시지를 받습니다.

## 3. 파티 생성

```json
{
  "t": "PARTY_CREATE",
  "reqId": "req2",
  "ts": 1234567890000,
  "p": {}
}
```

응답:
```json
{
  "t": "PARTY_CREATE",
  "reqId": "req2",
  "ts": 1234567890000,
  "p": {
    "id": "party_id",
    "leaderCharacterId": "clxxx",
    "speedMode": "TACTICAL",
    "members": [...]
  }
}
```

## 4. 이동

### 방향 기반 이동 (권장)

방향 코드로 이동합니다. 출구가 있어야 이동 가능합니다.

```json
{
  "t": "MOVE",
  "reqId": "req3",
  "ts": 1234567890000,
  "p": {
    "dir": "N"
  }
}
```

**허용되는 방향:**
- `N` / `NORTH` / `북` → 북쪽
- `S` / `SOUTH` / `남` → 남쪽
- `E` / `EAST` / `동` → 동쪽
- `W` / `WEST` / `서` → 서쪽
- `U` / `UP` → 위
- `D` / `DOWN` → 아래

**서버 처리:**
- 입력값을 `trim().toUpperCase()`로 정규화
- 매핑 지원 (NORTH/북 → N 등)
- 현재 룸의 출구 label에서 방향 추론하여 이동 가능 여부 확인

**리더가 이동하면 `follow=true` 파티원도 함께 이동합니다.**

응답:
```json
{
  "t": "LOG_APPEND",
  "ts": 1234567890000,
  "p": {
    "scope": "WORLD",
    "text": "이동했습니다."
  }
}
```

이후 `STATE_SYNC`로 새 룸 정보를 받습니다.

### 룸 ID 기반 이동 (개발자 모드)

개발/테스트용으로 룸 ID를 직접 지정할 수 있습니다.

```json
{
  "t": "MOVE",
  "reqId": "req3",
  "ts": 1234567890000,
  "p": {
    "roomId": "GH_MARKET"
  }
}
```

## 5. 이동 테스트: N/E 이동 후 HUNT

### 테스트 시나리오

1. **로그인 및 연결**
   - REST register/login
   - WS AUTH

2. **파티 생성**
   ```json
   { "t": "PARTY_CREATE", "p": {} }
   ```

3. **N 방향 이동** (START_TOWN → GH_SLUMS)
   ```json
   { "t": "MOVE", "p": { "dir": "N" } }
   ```
   - 상태바에서 "현재 룸: GH_SLUMS" 확인
   - 서버 로그에서 `[MOVE] characterId=..., name=..., currentRoomId=START_TOWN, 받은 dir=N, 정규화된 dir=N, availableExits=[N, E]` 확인

4. **E 방향 이동** (START_TOWN → R1_00)
   - 먼저 S 방향으로 START_TOWN으로 돌아가기
   ```json
   { "t": "MOVE", "p": { "dir": "S" } }
   ```
   - 그 다음 E 방향으로 이동
   ```json
   { "t": "MOVE", "p": { "dir": "E" } }
   ```
   - 상태바에서 "현재 룸: R1_00" 확인

5. **HUNT 실행**
   ```json
   { "t": "HUNT", "p": { "times": 1 } }
   ```
   - 전투 시작 및 자동 진행 확인

## 6. 사냥 (HUNT)

현재 룸에서 몬스터를 찾아 전투를 시작합니다.

```json
{
  "t": "HUNT",
  "reqId": "req4",
  "ts": 1234567890000,
  "p": {}
}
```

응답 (ENCOUNTER_START):
```json
{
  "t": "ENCOUNTER_START",
  "reqId": "req4",
  "ts": 1234567890000,
  "p": {
    "encounterId": "enc_id",
    "isBoss": false,
    "turnDeadlineAt": 1234567896000,
    "partySnapshot": [...],
    "enemySnapshot": [...]
  }
}
```

전투가 시작되면 턴 타이머가 자동으로 시작됩니다.

**중요: 입력하지 않아도 자동으로 턴이 진행됩니다!**
- FAST 모드: 6초마다 자동 턴 처리
- TACTICAL 모드: 9초마다 자동 턴 처리
- 미입력 시 자동 행동(프리셋)이 적용됩니다.

이후 `COMBAT_RESOLVE` 메시지가 6초(또는 9초)마다 자동으로 전송됩니다:
```json
{
  "t": "COMBAT_RESOLVE",
  "ts": 1234567890000,
  "p": {
    "encounterId": "enc_id",
    "turnNo": 1,
    "actions": ["캐릭터A이(가) 몬스터에게 8 피해를 입혔습니다..."],
    "state": {...}
  }
}
```

전투가 종료되면 `COMBAT_END` 메시지가 전송됩니다:
```json
{
  "t": "COMBAT_END",
  "ts": 1234567890000,
  "p": {
    "encounterId": "enc_id",
    "result": "WIN",
    "rewards": {
      "expGained": 50,
      "goldGained": 20,
      "items": [
        {
          "itemId": "ITEM_POTION_HP_S",
          "qty": 1
        }
      ]
    }
  }
}
```

### 보상(rewardsJson) 확인 항목

전투 승리 시 `COMBAT_END` 메시지의 `rewards` 필드에 다음이 포함됩니다:

- **expGained**: 획득한 경험치 (기본 50)
- **goldGained**: 획득한 골드 (기본 20)
- **items**: 드롭된 아이템 배열
  - `itemId`: 아이템 ID
  - `qty`: 수량

레벨업은 자동으로 처리되며:
- `nextExp(level) = 50 * level`
- 경험치가 기준을 넘으면 레벨업
- 레벨업 시 `hpMax +5`, `staminaMax +3`
- HP와 Stamina는 최대치로 회복

**중요: 입력하지 않아도 자동으로 턴이 진행됩니다!**
- FAST 모드: 6초마다 자동 턴 처리
- TACTICAL 모드: 9초마다 자동 턴 처리
- 미입력 시 자동 행동(프리셋)이 적용됩니다.

이후 `COMBAT_RESOLVE` 메시지가 6초(또는 9초)마다 자동으로 전송됩니다:
```json
{
  "t": "COMBAT_RESOLVE",
  "ts": 1234567890000,
  "p": {
    "encounterId": "enc_id",
    "turnNo": 1,
    "actions": ["캐릭터A이(가) 몬스터에게 8 피해를 입혔습니다..."],
    "state": {...}
  }
}
```

전투가 종료되면 `COMBAT_END` 메시지가 전송됩니다:
```json
{
  "t": "COMBAT_END",
  "ts": 1234567890000,
  "p": {
    "encounterId": "enc_id",
    "result": "WIN",
    "rewards": {
      "expGained": 50,
      "goldGained": 20,
      "items": [
        {
          "itemId": "ITEM_POTION_HP_S",
          "qty": 1
        }
      ]
    }
  }
}
```

### 보상(rewardsJson) 확인 항목

전투 승리 시 `COMBAT_END` 메시지의 `rewards` 필드에 다음이 포함됩니다:

- **expGained**: 획득한 경험치 (기본 50)
- **goldGained**: 획득한 골드 (기본 20)
- **items**: 드롭된 아이템 배열
  - `itemId`: 아이템 ID
  - `qty`: 수량

레벨업은 자동으로 처리되며:
- `nextExp(level) = 50 * level`
- 경험치가 기준을 넘으면 레벨업
- 레벨업 시 `hpMax +5`, `staminaMax +3`
- HP와 Stamina는 최대치로 회복

## 6. 전투 행동 (선택사항)

```json
{
  "t": "COMBAT_TURN",
  "reqId": "req5",
  "ts": 1234567890000,
  "p": {
    "encounterId": "enc_id",
    "action": "ATTACK",
    "targetId": "monster_id"
  }
}
```

행동 종류:
- `ATTACK` - 공격
- `DEFEND` - 방어
- `RETREAT` - 도주 투표

**미입력 시 자동 행동(프리셋)이 적용됩니다.**

### 타임뱅크 사용 (리더만)

```json
{
  "t": "COMBAT_TIMEBANK_USE",
  "reqId": "req6",
  "ts": 1234567890000,
  "p": {
    "encounterId": "enc_id"
  }
}
```

전투당 1회, +6초 연장됩니다.

## 7. 채팅

```json
{
  "t": "CHAT_SEND",
  "reqId": "req7",
  "ts": 1234567890000,
  "p": {
    "channel": "GLOBAL",
    "text": "안녕하세요!"
  }
}
```

채널 종류:
- `GLOBAL` - 전체 채팅
- `LOCAL` - 현재 룸
- `PARTY` - 파티
- `WHISPER` - 귓속말 (toName 필요)

**레이트 리밋: 초당 1회**

빠르게 여러 메시지를 보내면:
```json
{
  "t": "ERROR",
  "reqId": "req8",
  "ts": 1234567890000,
  "p": {
    "code": "RATE_LIMIT",
    "message": "채팅 속도가 너무 빠릅니다."
  }
}
```

## 8. 신고

```json
{
  "t": "REPORT_CREATE",
  "reqId": "req9",
  "ts": 1234567890000,
  "p": {
    "targetName": "BadUser",
    "reason": "욕설 사용"
  }
}
```

응답:
```json
{
  "t": "LOG_APPEND",
  "ts": 1234567890000,
  "p": {
    "scope": "SYSTEM",
    "text": "신고가 접수되었습니다."
  }
}
```

## 9. 전투 자동 진행 확인 (스모크 테스트 핵심)

### 체크리스트

✅ **HUNT 후 ENCOUNTER_START 수신**
- 전투가 시작되었다는 메시지

✅ **입력 없이도 COMBAT_RESOLVE가 6초(FAST) 또는 9초(TACTICAL)마다 자동 수신**
- 턴마다 전투 로그와 상태가 업데이트됨
- 플레이어가 아무것도 하지 않아도 자동으로 진행됨

✅ **전투 종료 시 COMBAT_END 수신**
- result: "WIN", "LOSE", "RETREAT" 중 하나
- rewards 정보 포함

### 자동 전투 테스트 순서

1. 회원가입 & 로그인 → 토큰 획득
2. WebSocket 연결 & AUTH
3. PARTY_CREATE
4. HUNT 실행
5. **아무것도 하지 않고 대기**
6. 6초마다 COMBAT_RESOLVE 메시지 확인
7. COMBAT_END 메시지로 전투 종료 확인

## 10. Admin API

### 신고 목록 조회

```bash
curl -X GET http://localhost:3000/admin/reports \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

### 제재 생성

```bash
curl -X POST http://localhost:3000/admin/punishments \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetName": "BadUser",
    "type": "MUTE",
    "note": "욕설 사용"
  }'
```

제재 타입:
- `MUTE` - 채팅 금지
- `BAN` - 로그인 차단

### 캐릭터 검색

```bash
curl -X GET "http://localhost:3000/admin/characters?name=Test" \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

## 10. 파티 기능

### 팔로우 설정

```json
{
  "t": "PARTY_FOLLOW_SET",
  "reqId": "req10",
  "ts": 1234567890000,
  "p": {
    "follow": false
  }
}
```

`follow=false`로 설정하면 리더가 이동해도 따라가지 않습니다.

### 속도 설정 (리더만)

```json
{
  "t": "PARTY_SPEED_SET",
  "reqId": "req11",
  "ts": 1234567890000,
  "p": {
    "speedMode": "FAST"
  }
}
```

- `FAST`: 6초
- `TACTICAL`: 9초

### 프리셋 설정

```json
{
  "t": "PARTY_PRESET_SET",
  "reqId": "req12",
  "ts": 1234567890000,
  "p": {
    "preset": "AGGRO"
  }
}
```

프리셋 종류:
- `AGGRO` - 공격
- `GUARD` - 방어
- `SAVER` - 공격
- `SUSTAIN` - 방어
- `SUPPORT` - 방어
- `RETREAT` - 도주 투표

## 에러 코드

- `RATE_LIMIT` - 레이트 리밋 초과
- `NOT_FOUND` - 리소스를 찾을 수 없음
- `INVALID_STATE` - 잘못된 상태 (예: 출구 없음)
- `FORBIDDEN` - 권한 없음 (예: 미인증)

## 테스트 시나리오

1. **기본 플레이**
   - 회원가입 → 로그인 → WebSocket 연결 → AUTH
   - 파티 생성 → 이동 → 사냥 → 전투

2. **레이트 리밋 확인**
   - 채팅 연속 5회 전송 → 6번째 ERROR

3. **신고/제재**
   - REPORT_CREATE → Admin API로 신고 확인
   - 제재 생성 → MUTE 확인 (채팅 차단)

4. **파티 이동**
   - 2명 파티 생성
   - 리더 이동 → follow=true 멤버 동행 확인
   - follow=false 설정 → 리더 이동 시 미동행 확인

## 주의사항

- WebSocket 메시지는 반드시 JSON 문자열이어야 합니다.
- 모든 타임스탬프는 밀리초 단위입니다.
- `reqId`는 요청-응답 매칭용이며 선택사항입니다.

