# MUD Game

턴제 텍스트 MUD 게임 - NestJS 기반 모노레포

## 🚀 1분 개발 환경 시작

**개발 환경 (권장):**

```bash
# 최초 1회
pnpm install

# 개발 시작 (인프라 시작 → DB 준비 → 마이그레이션 → 시드 → 서버 + Flutter 실행)
pnpm dev:android
```

**프로덕션 유사 환경 (Docker):**

```bash
# Docker 기반 전체 스택 실행
pnpm prod:up
```

**문서:**
- 개발 가이드: [docs/DEV_QUICKSTART.md](./docs/DEV_QUICKSTART.md)
- 프로덕션 배포: [docs/DEPLOY_LOCAL_PRODLIKE.md](./docs/DEPLOY_LOCAL_PRODLIKE.md)

---

## 프로젝트 구조

```
mud/
├── apps/
│   └── server/          # NestJS 게임 서버
├── mud_client/          # Flutter 앱
├── infra/
│   └── docker-compose.yml # DB & Redis
├── tools/               # 빌드/검증 도구
└── docs/                # 문서
```

---

## 주요 기능

- ✅ 회원가입/로그인 (JWT 인증)
- ✅ WebSocket 기반 실시간 게임
- ✅ 파티 시스템 (최대 6인)
- ✅ 리더 자동 + 팔로우 시스템
- ✅ 턴제 전투 (FAST 6초 / TACTICAL 9초)
- ✅ 자동 전투 처리
- ✅ 타임뱅크 시스템
- ✅ 레이트 리밋 (채팅/이동/전투)
- ✅ 채팅 시스템 (GLOBAL/LOCAL/PARTY/WHISPER)
- ✅ 신고/처재 시스템 (MUTE/BAN)
- ✅ Admin API
- ✅ 퀘스트 시스템 (DAILY/WEEKLY/STORY)
- ✅ 상점 시스템
- ✅ 시즌 시스템

---

## 맵 구성

- 도시 10개 방 (그레이하운드)
- 미궁 1층 20개 방 (5x4 격자)
- 미궁 2층 20개 방 (5x4 격자)
- 총 50+ 방

---

## API 문서

### REST API

#### Auth

- `POST /auth/register` - 회원가입
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "characterName": "Hero"
  }
  ```

- `POST /auth/login` - 로그인
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

#### Admin (x-admin-key 헤더 필요)

- `GET /admin/reports` - 신고 목록
- `POST /admin/punishments` - 처재 생성
- `DELETE /admin/punishments/:id` - 처재 해제
- `GET /admin/characters?name=` - 캐릭터 검색

### WebSocket

메시지 포맷:
```json
{
  "t": "EVENT_NAME",
  "reqId": "unique-id",
  "ts": 1234567890,
  "p": {}
}
```

주요 이벤트:
- `AUTH` - 인증
- `MOVE` - 이동
- `HUNT` - 사냥
- `PARTY_CREATE` - 파티 생성
- `PARTY_INVITE` - 파티 초대
- `PARTY_JOIN` - 파티 참가
- `PARTY_LEAVE` - 파티 탈퇴
- `PARTY_FOLLOW_SET` - 팔로우 설정
- `PARTY_SPEED_SET` - 속도 설정
- `PARTY_PRESET_SET` - 프리셋 설정
- `COMBAT_TURN` - 전투 행동
- `COMBAT_TIMEBANK_USE` - 타임뱅크 사용
- `CHAT_SEND` - 채팅
- `REPORT_CREATE` - 신고
- `QUEST_LIST` - 퀘스트 목록
- `QUEST_ACCEPT` - 퀘스트 수락
- `QUEST_TURNIN` - 퀘스트 제출
- `SHOP_LIST` - 상점 목록
- `SHOP_BUY` - 아이템 구매

자세한 내용은 서버 코드 참조

---

## 품질 게이트

PR 머지 전 다음 명령어가 모두 통과해야 합니다:

```bash
# Content 검증
pnpm content:validate

# Catalog 동기화 (변경 사항 커밋 필요)
pnpm catalog:sync

# Smoke 테스트 (E2E)
cd apps/server
$env:TEST_MODE="true"
pnpm smoke

# Flutter 분석
cd mud_client
flutter analyze
```

---

## (Legacy) 수동 실행

> **⚠️ 원칙적으로 `pnpm dev:android` 사용 권장**
> 
> 아래는 특수 상황(디버깅, 단계별 확인)에서만 사용하세요.

<details>
<summary>수동 실행 단계 보기</summary>

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 데이터베이스 시작

```bash
cd infra
docker-compose up -d
```

### 3. 환경 변수 설정

```bash
cd apps/server
cp .env.example .env
# .env 파일을 편집하여 필요한 값 설정
```

### 4. 데이터베이스 마이그레이션 및 시드

```bash
pnpm --filter server prisma:generate
pnpm --filter server prisma migrate dev
pnpm --filter server prisma db seed
```

### 5. 서버 실행

```bash
# 개발 모드
pnpm --filter server dev

# 프로덕션
pnpm --filter server build
pnpm --filter server start
```

### 6. Flutter 앱 실행 (별도 터미널)

```bash
cd mud_client
flutter pub get
flutter run
```

</details>

---

## 환경 변수

`apps/server/.env.example` 참조

---

## 라이선스

ISC
