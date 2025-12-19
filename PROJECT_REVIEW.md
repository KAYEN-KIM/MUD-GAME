# MUD Game 프로젝트 종합 검토 문서

## 📋 프로젝트 개요

**프로젝트명**: 판타지 텍스트 MUD (Multi-User Dungeon) 게임  
**아키텍처**: 모노레포 (pnpm workspace)  
**서버**: NestJS + TypeScript + PostgreSQL + Redis  
**클라이언트**: Flutter (Dart)  
**목표**: 한국 서버 단일 대상 MVP - 로컬 실행 가능한 완전한 플레이 루프

---

## 🏗️ 프로젝트 구조

```
C:\Users\Kyung\Mud Game\
├── apps/
│   └── server/                    # NestJS 게임 서버
│       ├── src/
│       │   ├── main.ts            # 진입점
│       │   ├── app.module.ts      # 루트 모듈
│       │   ├── common/            # 공통 모듈
│       │   │   ├── config/        # 환경 변수 검증 (Zod)
│       │   │   ├── guards/       # 인증/권한 가드
│       │   │   ├── utils/        # 유틸리티 (time, rng, text)
│       │   │   ├── prisma.service.ts
│       │   │   └── redis.service.ts
│       │   ├── rate-limit/       # Redis 기반 레이트 리밋
│       │   ├── modules/
│       │   │   ├── auth/         # REST 인증 (register/login)
│       │   │   ├── ws/           # WebSocket Gateway
│       │   │   ├── world/        # 이동, 사냥
│       │   │   ├── party/        # 파티 시스템
│       │   │   ├── combat/       # 전투 시스템
│       │   │   ├── chat/         # 채팅 시스템
│       │   │   └── admin/        # 관리자 API
│       │   └── content/         # JSON 데이터 (rooms, monsters, items, quests)
│       ├── prisma/
│       │   ├── schema.prisma    # Prisma 스키마
│       │   └── seed.ts          # 시드 스크립트 (50개 룸 자동 생성)
│       └── test/                # Jest 테스트
├── mud_client/                   # Flutter 클라이언트
│   ├── lib/
│   │   ├── main.dart            # 진입점
│   │   ├── app.dart             # MaterialApp 설정
│   │   ├── core/                # 핵심 모듈
│   │   │   ├── models.dart      # 데이터 모델
│   │   │   ├── storage.dart     # Secure Storage
│   │   │   ├── endpoints.dart   # 플랫폼별 기본 URL
│   │   │   ├── api_client.dart  # REST API 클라이언트
│   │   │   └── ws_client.dart   # WebSocket 클라이언트
│   │   ├── state/
│   │   │   └── session_state.dart # Provider 상태 관리
│   │   └── features/
│   │       ├── auth/            # 로그인/회원가입 화면
│   │       ├── settings/        # 서버 설정 화면
│   │       └── home/            # 메인 게임 화면
│   │           └── widgets/
│   │               ├── log_view.dart    # 로그 피드
│   │               └── action_bar.dart  # 액션 버튼
│   └── pubspec.yaml
├── infra/
│   └── docker-compose.yml        # PostgreSQL + Redis
├── tools/
│   ├── smoke.js                 # 자동 스모크 테스트
│   └── ws-smoke.md              # WebSocket 테스트 가이드
└── README.md
```

---

## 🎮 게임 규칙 및 메커니즘

### 월드 구조
- **도시 (그레이하버)**: 10개 룸 (GH_*)
- **미궁 1층**: 20개 룸 (R1_00 ~ R1_19) - 5x4 격자
- **미궁 2층**: 20개 룸 (R2_00 ~ R2_19) - 5x4 격자
- **총 50개 룸**

### 파티 시스템
- 최대 6명
- 리더 이동 시 팔로워 자동 이동
- 팔로우 ON/OFF 설정 가능
- 속도 모드: FAST (6초) / TACTICAL (9초)

### 전투 시스템
- **턴제 전투** (자동 진행)
- **타이머**: FAST 6초, TACTICAL 9초
- **자동 행동**: 프리셋 (ATTACK/DEFEND/RETREAT)
- **프리셋**: 미리 행동 선택 가능
- **소프트 타이머**: 사용자 입력 시 타이머 리셋
- **타임뱅크**: 추가 시간 확보
- **후퇴 투표**: 파티 멤버 과반수 동의 시 후퇴

### 전투 보상 시스템
- **경험치**: 기본 50 (고정)
- **골드**: 기본 20 (고정)
- **아이템 드롭**: MonsterDrop 테이블 기반 (chanceBp 확률)
- **레벨업**: `nextExp(level) = 50 * level`
  - 레벨업 시 `hpMax +5`, `staminaMax +3`
  - HP/Stamina 최대치로 회복

---

## 🗄️ 데이터베이스 스키마 (Prisma)

### 주요 모델

#### User
- `id`, `email`, `password` (bcrypt), `createdAt`, `updatedAt`

#### Character
- `id`, `userId`, `name`, `level`, `exp`, `gold`
- `hp`, `hpMax`, `stamina`, `staminaMax`
- `str`, `dex`, `int`, `roomId` (현재 위치)
- `createdAt`, `updatedAt`

#### Room
- `id` (예: GH_00, R1_00, R2_00)
- `name`, `description`, `type` (CITY/DUNGEON_1F/DUNGEON_2F)
- `exits` (RoomExit 관계)

#### RoomExit
- `id`, `fromRoomId`, `toRoomId`, `direction` (N/S/E/W/U/D)

#### Monster
- `id`, `name`, `level`, `hp`, `hpMax`, `atk`, `def`
- `isBoss`, `drops` (MonsterDrop 관계)

#### Item
- `id`, `name`, `type`, `rarity`, `stackMax`
- `effectJson` (JSON)

#### MonsterDrop
- `monsterId`, `itemId`, `minQty`, `maxQty`, `chanceBp` (basis points, 10000 = 100%)

#### Party
- `id`, `leaderId`, `speedMode` (FAST/TACTICAL)
- `members` (PartyMember 관계, 최대 6명)

#### PartyMember
- `partyId`, `characterId`, `role` (LEADER/MEMBER)
- `follow`, `autoPreset` (ATTACK/DEFEND/RETREAT)

#### Encounter
- `id`, `partyId`, `roomId`, `monsterId`
- `turnNo`, `turnDeadlineAt`, `isBoss`
- `stateJson` (JSON) - 전투 상태 저장
- `endedAt`, `result` (WIN/LOSE/RETREAT)

#### ChatMessage
- `id`, `characterId`, `channel` (GLOBAL/LOCAL/PARTY/WHISPER)
- `text`, `createdAt`

#### Report
- `id`, `reporterId`, `targetId`, `reason`, `status`

#### Punishment
- `id`, `characterId`, `type` (MUTE/BAN), `expiresAt`

---

## 🔌 WebSocket 프로토콜

### 메시지 포맷
```json
{
  "t": "EVENT_NAME",
  "reqId": "unique-id",
  "ts": 1234567890,
  "p": { /* payload */ }
}
```

### 주요 이벤트

#### 클라이언트 → 서버

1. **AUTH**
   ```json
   { "t": "AUTH", "p": { "token": "jwt_token" } }
   ```

2. **PARTY_CREATE**
   ```json
   { "t": "PARTY_CREATE", "p": {} }
   ```

3. **MOVE**
   ```json
   { "t": "MOVE", "p": { "roomId": "R1_00" } }
   ```

4. **HUNT**
   ```json
   { "t": "HUNT", "p": { "times": 1 } }
   ```

5. **COMBAT_TURN**
   ```json
   { "t": "COMBAT_TURN", "p": { "encounterId": "...", "action": "ATTACK" } }
   ```

6. **CHAT_SEND**
   ```json
   { "t": "CHAT_SEND", "p": { "channel": "GLOBAL", "text": "안녕하세요" } }
   ```

#### 서버 → 클라이언트

1. **AUTH_OK** / **AUTH_FAIL**
2. **LOG_APPEND** - 게임 로그
   ```json
   { "t": "LOG_APPEND", "p": { "scope": "COMBAT", "text": "전투 시작!" } }
   ```

3. **STATE_SYNC** - 게임 상태 동기화
   ```json
   { "t": "STATE_SYNC", "p": { "character": {...}, "party": {...}, "encounter": {...} } }
   ```

4. **ENCOUNTER_START** - 전투 시작
   ```json
   { "t": "ENCOUNTER_START", "p": { "encounterId": "...", "turnDeadlineAt": 1234567890 } }
   ```

5. **COMBAT_RESOLVE** - 턴 해결
   ```json
   { "t": "COMBAT_RESOLVE", "p": { "turnNo": 1, "actions": ["..."], "state": {...} } }
   ```

6. **COMBAT_END** - 전투 종료
   ```json
   { "t": "COMBAT_END", "p": { "result": "WIN", "rewards": { "expGained": 50, "goldGained": 20, "items": [...] } } }
   ```

7. **ERROR**
   ```json
   { "t": "ERROR", "p": { "code": "RATE_LIMIT", "message": "..." } }
   ```

---

## 🔐 REST API

### 인증 (Auth)

#### POST /auth/register
```json
Request:
{
  "email": "user@example.com",
  "password": "password123",
  "characterName": "Hero"
}

Response:
{
  "token": "jwt_token",
  "character": { "id": "...", "name": "Hero", ... }
}
```

#### POST /auth/login
```json
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "token": "jwt_token",
  "character": { "id": "...", "name": "Hero", ... }
}
```

### 관리자 API (x-admin-key 헤더 필요)

- `GET /admin/reports` - 신고 목록
- `POST /admin/punishments` - 제재 생성
- `DELETE /admin/punishments/:id` - 제재 삭제
- `GET /admin/characters?name=` - 캐릭터 검색

---

## ⚙️ 주요 구현 세부사항

### 1. 전투 시스템 (`combat.service.ts`)

#### `resolveTurn()` 메서드
- 전투 턴 자동 해결
- 플레이어 행동 결정 (프리셋 또는 자동)
- 데미지 계산: `baseAtk = max(1, str + level) - def`
- 몬스터 공격 처리
- 전투 종료 조건 확인 (WIN/LOSE/RETREAT)
- 동시 호출 방지 (락 메커니즘)

#### `applyRewards()` 메서드
- 전투 승리 시 보상 적용
- Prisma 트랜잭션으로 안전하게 처리
- 경험치/골드 지급
- MonsterDrop 기반 아이템 드롭 (chanceBp 확률)
- 레벨업 처리 (`nextExp = 50 * level`)
- HP/Stamina 최대치 증가 및 회복

### 2. WebSocket Gateway (`ws.gateway.ts`)

#### 전투 타이머 시스템
- `encounterTimers` Map으로 타이머 관리
- `scheduleEncounter()` - 턴 타이머 스케줄링
- `clearEncounterTimer()` - 타이머 정리
- FAST 모드: 6초, TACTICAL 모드: 9초
- 사용자 입력 시 소프트 타이머 리셋

#### 메시지 라우팅
- `handleMessage()` - 클라이언트 메시지 수신
- 각 이벤트 타입별 핸들러 호출
- 인증 가드 적용 (`WSAuthGuard`)
- 에러 처리 및 로그 브로드캐스트

### 3. 레이트 리밋 (`rate-limit.service.ts`)

Redis 기반 레이트 리밋:
- **CHAT**: 10초당 5회
- **MOVE**: 3초당 1회
- **HUNT**: 5초당 1회
- **COMBAT_TURN**: 1초당 1회

### 4. 파티 시스템 (`party.service.ts`)

- 파티 생성/초대/참가/탈퇴
- 리더 변경
- 팔로우 설정
- 속도 모드 설정 (FAST/TACTICAL)
- 자동 행동 프리셋 설정
- 리더 이동 시 팔로워 자동 이동

### 5. Flutter 클라이언트

#### 상태 관리 (`session_state.dart`)
- Provider 패턴 사용
- WebSocket 연결 관리
- 게임 상태 동기화 (GameState)
- 로그 관리 (LogEntry 리스트)

#### WebSocket 클라이언트 (`ws_client.dart`)
- `web_socket_channel` 패키지 사용
- 자동 AUTH 전송
- 메시지 송수신 처리
- 재연결 지원

#### Secure Storage (`storage.dart`)
- `flutter_secure_storage` 사용
- JWT 토큰 저장
- REST/WS URL 저장

---

## 🧪 테스트

### 서버 테스트 (Jest)

1. **rate-limit.spec.ts** - 레이트 리밋 테스트
2. **party-move.spec.ts** - 파티 이동 테스트
3. **chat-mute.spec.ts** - 채팅 뮤트 테스트
4. **combat-rewards.spec.ts** - 전투 보상 테스트

### 자동 스모크 테스트 (`tools/smoke.js`)

Node.js 스크립트:
1. REST register/login
2. WebSocket 연결 및 AUTH
3. 파티 생성
4. 사냥 시작
5. 전투 자동 진행 대기 (최대 40초)
6. COMBAT_END 및 rewardsJson 확인

실행:
```bash
pnpm smoke
```

---

## 🚀 실행 방법

### 서버 실행

```bash
# 1. 의존성 설치
pnpm -w install

# 2. 데이터베이스 시작
docker compose -f infra/docker-compose.yml up -d

# 3. 환경 변수 설정
cd apps/server
cp .env.example .env
# .env 파일 편집

# 4. 데이터베이스 마이그레이션 및 시드
pnpm --filter server prisma:generate
pnpm --filter server prisma:migrate
pnpm --filter server prisma:seed

# 5. 서버 실행
pnpm --filter server dev
```

### Flutter 클라이언트 실행

```bash
cd mud_client
flutter pub get
flutter run
```

**Android 에뮬레이터**: 기본 URL `http://10.0.2.2:3000`  
**Desktop**: 기본 URL `http://localhost:3000`

---

## 📝 환경 변수

### 서버 (.env)

```env
# 데이터베이스
DATABASE_URL=postgresql://mud:mudpass@localhost:5432/mud
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# 관리자
ADMIN_KEY=your-admin-key

# 레이트 리밋
RATE_LIMIT_CHAT_WINDOW=10
RATE_LIMIT_CHAT_MAX=5
RATE_LIMIT_MOVE_WINDOW=3
RATE_LIMIT_MOVE_MAX=1
RATE_LIMIT_HUNT_WINDOW=5
RATE_LIMIT_HUNT_MAX=1
RATE_LIMIT_COMBAT_TURN_WINDOW=1
RATE_LIMIT_COMBAT_TURN_MAX=1

# 전투 타이머
COMBAT_FAST_SECONDS=6
COMBAT_TACTICAL_SECONDS=9

# 서버
PORT=3000
NODE_ENV=development
```

---

## 🔧 주요 기술 스택

### 서버
- **NestJS** 10.3.0 - 프레임워크
- **TypeScript** 5.5.4 - 언어
- **Prisma** 5.19.0 - ORM
- **PostgreSQL** 16 - 데이터베이스
- **Redis** 7 - 캐시/레이트 리밋
- **WebSocket** (ws 패키지) - 실시간 통신
- **JWT** - 인증
- **bcrypt** - 비밀번호 해싱
- **Zod** - 환경 변수 검증

### 클라이언트
- **Flutter** 3.x - 프레임워크
- **Dart** 3.2.0+ - 언어
- **Provider** 6.1.1 - 상태 관리
- **http** 1.1.0 - REST API
- **web_socket_channel** 2.4.0 - WebSocket
- **flutter_secure_storage** 9.0.0 - 보안 저장소

---

## ✅ 구현 완료 기능

### 서버
- ✅ 회원가입/로그인 (JWT)
- ✅ WebSocket 인증
- ✅ 파티 시스템 (생성/초대/참가/탈퇴/리더 변경)
- ✅ 이동 시스템 (리더 + 팔로워)
- ✅ 사냥 시스템
- ✅ 전투 시스템 (자동 진행, 타이머, 프리셋)
- ✅ 전투 보상 (경험치/골드/드롭/레벨업)
- ✅ 채팅 시스템 (GLOBAL/LOCAL/PARTY/WHISPER)
- ✅ 레이트 리밋 (Redis 기반)
- ✅ 신고/제재 시스템
- ✅ Admin API
- ✅ 시드 데이터 (50개 룸 자동 생성)

### 클라이언트
- ✅ 서버 설정 화면 (REST/WS URL)
- ✅ 회원가입/로그인 화면
- ✅ WebSocket 연결 및 AUTH
- ✅ 실시간 로그 피드
- ✅ 게임 액션 버튼 (파티/이동/사냥/전투/채팅)
- ✅ 상태바 (캐릭터/룸/파티/전투 상태)
- ✅ 현재 REST/WS 주소 표시
- ✅ Secure Storage (JWT, URLs)

---

## 🐛 알려진 이슈 및 제한사항

1. **드롭 테이블이 비어있을 때**: 임시로 기본 아이템 1개 드롭 (TODO 명시)
2. **전투 턴 해결 로직**: MVP 수준 구현, 향후 상세 로직 필요
3. **스킬 시스템**: 미구현
4. **아이템 사용**: 미구현
5. **퀘스트 진행**: 미구현
6. **장비 시스템**: 기본 구조만 존재

---

## 📚 참고 문서

- `README.md` - 프로젝트 루트 README
- `apps/server/README.md` - 서버 README
- `mud_client/README.md` - 클라이언트 README
- `tools/ws-smoke.md` - WebSocket 스모크 테스트 가이드

---

## 🔄 개발 히스토리

### 주요 마일스톤

1. **초기 프로젝트 구조 생성**
   - 모노레포 설정 (pnpm workspace)
   - NestJS 서버 기본 구조
   - Prisma 스키마 작성

2. **게임 로직 구현**
   - 파티 시스템
   - 이동 시스템
   - 전투 시스템 기본 구조

3. **전투 시스템 완성**
   - `resolveTurn()` 구현
   - 전투 타이머 시스템
   - 자동 턴 진행

4. **보상 시스템 구현**
   - `applyRewards()` 구현
   - 경험치/골드 지급
   - 아이템 드롭
   - 레벨업 시스템

5. **Flutter 클라이언트 구현**
   - 기본 UI 구조
   - WebSocket 클라이언트
   - 상태 관리
   - 설정 화면 개선

6. **버그 수정**
   - Dart null-safe 처리
   - TypeScript 타입 오류 수정
   - 의존성 주입 오류 수정

---

## 🎯 다음 단계 (MVP 이후)

- [ ] 전투 턴 해결 로직 상세 구현
- [ ] 스킬 시스템
- [ ] 아이템 사용 시스템
- [ ] 퀘스트 진행 시스템
- [ ] 경험치/레벨업 시스템 상세화
- [ ] 장비 시스템 상세 구현
- [ ] 모바일 UI/UX 개선
- [ ] 오프라인 모드 지원

---

**문서 생성일**: 2025-12-15  
**프로젝트 상태**: MVP 완료, 로컬 실행 가능

