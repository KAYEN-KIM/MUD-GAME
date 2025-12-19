# Dev Quickstart

## 🚀 1분 개발 환경 시작 가이드

### 사전 준비

다음 소프트웨어가 설치되어 있어야 합니다:

1. **Docker Desktop** (Windows/Mac/Linux)
   - PostgreSQL 및 Redis 컨테이너 실행에 필요
   - [다운로드](https://www.docker.com/products/docker-desktop/)

2. **Flutter SDK** (3.24.5+)
   - Flutter 앱 실행에 필요
   - [설치 가이드](https://docs.flutter.dev/get-started/install)

3. **Android Studio** (선택)
   - Android 에뮬레이터 실행용
   - [다운로드](https://developer.android.com/studio)

4. **Node.js** (20+) & **pnpm**
   - 서버 및 빌드 도구 실행
   ```bash
   npm install -g pnpm
   ```

---

## 최초 1회 설정

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`apps/server/.env` 파일을 생성하고 다음 내용을 추가:

```env
NODE_ENV=development
PORT=3000
TZ=Asia/Seoul

# Database
DATABASE_URL=postgresql://mud:mudpass@localhost:5432/mud

# Redis
REDIS_URL=redis://localhost:6379

# JWT (임의 생성)
JWT_SECRET=your-jwt-secret-key-change-this-in-production

# Admin
ADMIN_KEY=your-admin-key-change-this

# Rate Limit (개발 시 낮춤)
RL_CHAT_PER_SEC=5
RL_MOVE_PER_SEC=10
RL_COMBAT_TURN_PER_SEC=5

# Combat Timing
TURN_SEC_FAST=6
TURN_SEC_TACTICAL=9
TIMEBANK_ADD_SEC=6
TIMEBANK_PER_ENCOUNTER=1

# Cooldowns
CD_HUNT_MS=2000

# Test Mode (선택)
# TEST_MODE=true
```

---

## 개발 시작 (원커맨드)

### Android 에뮬레이터 실행

```bash
pnpm dev:android
```

**이 명령어 하나로 다음이 자동 실행됩니다:**

1. ✅ Docker Compose로 PostgreSQL, Redis 시작
2. ✅ DB 준비 대기 (최대 60초)
3. ✅ Prisma migrate deploy (스키마 배포)
4. ✅ Prisma seed (초기 데이터 삽입)
5. ✅ 서버 개발 모드 시작 (watch)
6. ✅ Flutter 앱 실행 (Android)

**중간에 DB가 준비되지 않아 멈추는 일이 없습니다!**

---

## 개발 종료

### 서버 & 앱 종료

`Ctrl+C`로 concurrently 프로세스 종료

### 인프라 종료

```bash
pnpm infra:down
```

Docker 컨테이너 (PostgreSQL, Redis)가 종료됩니다.

---

## 개별 명령어 (고급)

필요 시 개별 단계를 수동으로 실행할 수 있습니다:

```bash
# 1. 인프라만 시작
pnpm infra:up

# 2. DB 준비 대기
pnpm db:wait

# 3. 마이그레이션
pnpm server:migrate

# 4. 시드
pnpm server:seed

# 5. 서버만 실행
pnpm server:dev

# 6. Flutter만 실행 (다른 터미널)
pnpm flutter:run:android
```

---

## 품질 검증 (PR 전 실행 권장)

```bash
# Content 검증
pnpm content:validate

# Catalog 동기화 (변경 사항이 있으면 커밋 필요)
pnpm catalog:sync

# 변경 사항 확인
git status

# Smoke 테스트 (E2E)
cd apps/server
$env:TEST_MODE="true"
pnpm smoke

# Flutter 분석
cd mud_client
flutter analyze
```

**Catalog 동기화 관련:**
- `pnpm catalog:sync` 실행 후 `mud_client/assets/catalog/items_catalog.json`이 변경될 수 있습니다.
- 변경 사항이 있다면 **반드시 커밋**해야 CI가 통과합니다.
- CI에서는 `git diff --exit-code`로 변경 여부를 확인합니다.

---

## 문제 해결

### Docker 컨테이너가 시작되지 않음

```bash
# Docker Desktop 실행 확인
docker ps

# 포트 충돌 확인 (5432, 6379)
# Windows: netstat -ano | findstr ":5432"
# Linux/Mac: lsof -i :5432

# 기존 컨테이너 정리
pnpm infra:down
docker system prune -f
pnpm infra:up
```

### DB 연결 실패

```bash
# .env 파일 확인
cat apps/server/.env

# DATABASE_URL이 올바른지 확인
# postgresql://mud:mudpass@localhost:5432/mud
```

### Flutter 에뮬레이터가 시작되지 않음

```bash
# Android 에뮬레이터 목록 확인
flutter emulators

# 에뮬레이터 실행 (Android Studio에서 수동 실행 권장)
flutter emulators --launch <emulator_id>

# 실제 기기 연결 확인
flutter devices
```

---

## 더 많은 정보

- [Prisma 스키마](../apps/server/prisma/schema.prisma)
- [CI 워크플로우](../.github/workflows/ci.yml)

## 레거시 스크립트 (특수 상황용)

프로젝트에는 `tools/run_manual_verify.ps1`이 존재하지만, **일반 개발에는 `pnpm dev:android`을 사용하세요.**

레거시 스크립트는 다음과 같은 특수 상황에서만 사용:
- 디버깅: 각 단계를 수동으로 확인해야 할 때
- 서버만 실행: Flutter 없이 서버만 테스트할 때

```bash
# 레거시 방식 (권장하지 않음)
powershell -ExecutionPolicy Bypass -File tools/run_manual_verify.ps1
```

