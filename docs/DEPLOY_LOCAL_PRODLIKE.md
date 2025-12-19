# 프로덕션 유사 환경 로컬 배포 가이드

> ⚠️ **중요**: 이 문서는 운영 흉내 환경이며 데이터가 영속화됩니다.  
> **개발용은 `pnpm dev:android`를 사용하세요.**

---

## 🎯 목적

Docker Compose를 사용하여 **프로덕션 유사 환경**을 로컬에서 실행합니다.

**이 환경의 특징:**
- ✅ 프로덕션 빌드 (최적화됨)
- ✅ 영속 볼륨 (데이터 유지)
- ✅ Healthcheck 기반 시작 순서
- ✅ S1 Only 정책 (MAX_UNLOCKED_SEASON=1)

---

## 🚨 운영 원칙 (CRITICAL)

### S1 Only 정책

**프로덕션 기본값:**
- `MAX_UNLOCKED_SEASON=1` (S1만 접근 가능)
- `TEST_MODE=false` (락 우회 금지)

**절대 금지:**
- ❌ 프로덕션에서 `TEST_MODE=true` 설정
- ❌ 프로덕션에서 `MAX_UNLOCKED_SEASON > 1` (S2 준비 전까지)

**TEST_MODE는 개발/CI에서만 사용:**
```bash
# 개발/테스트 전용
TEST_MODE=true pnpm smoke
```

---

## 🔧 사전 준비

### 1. Docker Desktop 실행 확인

```powershell
# PowerShell
docker ps
```

포트 확인 (충돌 방지):
```powershell
Test-NetConnection 127.0.0.1 -Port 3000
Test-NetConnection 127.0.0.1 -Port 5432
Test-NetConnection 127.0.0.1 -Port 6379
```

### 2. pnpm 의존성 설치 (최초 1회)

```bash
pnpm install
```

---

## 🚀 최초 1회 설정

### 1. 환경 변수 파일 생성

```bash
cd infra
cp env.prodlike.example env.prodlike
```

### 2. env.prodlike 값 채우기

**필수 변경 항목:**
```env
# Security (반드시 변경!)
JWT_SECRET=your-strong-jwt-secret-here
ADMIN_KEY=your-strong-admin-key-here

# Season Policy (확인!)
MAX_UNLOCKED_SEASON=1
TEST_MODE=false
```

**나머지는 기본값 사용 가능.**

### 3. 전체 스택 시작

```bash
# 루트 디렉터리에서
pnpm prod:up
```

**최초 실행 시 Docker 이미지 빌드로 3-5분 소요됩니다.**

### 4. 데이터베이스 마이그레이션

```bash
pnpm prod:migrate
```

### 5. 시드 데이터 삽입 (최초 1회만!)

> ⚠️ **주의**: 시드는 **최초 1회만** 실행하세요.  
> 재실행 시 데이터 중복/충돌 가능성이 있습니다.

```bash
pnpm prod:seed
```

---

## ✅ 접속 확인

### Health Check

```powershell
# PowerShell
Invoke-RestMethod http://127.0.0.1:3000/health

# 예상 응답:
# {
#   "status": "ok",
#   "timestamp": 1734700000000,
#   "testMode": false,
#   "maxUnlockedSeason": 1,
#   "checks": {
#     "database": true,
#     "redis": true
#   }
# }
```

### 포트 확인

```powershell
Test-NetConnection 127.0.0.1 -Port 3000
# TcpTestSucceeded : True
```

### 엔드포인트

- **REST API**: http://127.0.0.1:3000
- **WebSocket**: ws://127.0.0.1:3000
- **Health Check**: http://127.0.0.1:3000/health

---

## 📊 평상시 배포 (재기동)

### 서버만 재시작

```bash
pnpm prod:up
```

**이미 실행 중인 컨테이너는 재사용됩니다.**

### 로그 확인

```bash
# Server 로그 실시간 확인
pnpm prod:logs

# 모든 컨테이너 상태
cd infra
docker-compose -f docker-compose.yml -f docker-compose.server.yml ps
```

### 환경 변수 변경 후 재시작

```bash
# env.prodlike 수정 후
pnpm prod:down
pnpm prod:up
```

---

## 🔄 롤백 전략

### 이미지 태그 변경

`infra/docker-compose.server.yml`에서 이미지 태그를 이전 버전으로 변경:

```yaml
services:
  server:
    image: mud-server:previous-tag  # 빌드 대신 이미지 지정
    # build: ... 주석 처리
```

```bash
pnpm prod:down
pnpm prod:up
```

### 데이터베이스 롤백

마이그레이션 롤백은 Prisma 정책에 따라 수동 처리:

```bash
# 컨테이너 내부 접속
docker exec -it mud-server sh

# 마이그레이션 확인
npx prisma migrate status

# 롤백 (수동 SQL 또는 백업 복원)
```

---

## 🛠️ 문제 해결

### 포트 충돌 (Port already in use)

```powershell
# 포트 3000 사용 프로세스 확인
netstat -ano | findstr ":3000"

# 프로세스 종료
Stop-Process -Id <PID> -Force
```

### DB 연결 실패

```bash
# PostgreSQL 준비 확인
docker exec mud-postgres pg_isready -U mud

# 서버 재시작
cd infra
docker-compose -f docker-compose.yml -f docker-compose.server.yml restart server
```

### 이미지 빌드 실패

```bash
# 캐시 없이 재빌드
cd infra
docker-compose -f docker-compose.yml -f docker-compose.server.yml build --no-cache server
docker-compose -f docker-compose.yml -f docker-compose.server.yml up -d
```

### Health Check 실패

```bash
# Server 로그 확인
pnpm prod:logs

# DB/Redis 상태 확인
docker exec mud-postgres pg_isready -U mud
docker exec mud-redis redis-cli ping
```

### 볼륨 완전 초기화 (데이터 삭제)

> ⚠️ **주의**: 모든 데이터가 삭제됩니다!

```bash
cd infra
docker-compose -f docker-compose.yml -f docker-compose.server.yml down -v
pnpm prod:up
pnpm prod:migrate
pnpm prod:seed
```

---

## 🔍 환경 변수 커스터마이징

`infra/env.prodlike` 파일에서 수정 가능:

```env
# 시즌 정책 변경 (S2 준비 시)
MAX_UNLOCKED_SEASON=2

# Rate Limit 조정
RL_CHAT_PER_SEC=10
RL_MOVE_PER_SEC=20

# Combat 타이밍 변경
TURN_SEC_FAST=5
TURN_SEC_TACTICAL=8
```

**변경 후 재시작 필수:**
```bash
pnpm prod:down
pnpm prod:up
```

---

## 📋 개발 환경 vs 프로덕션 유사 환경

| 항목 | 개발 (`pnpm dev:android`) | 프로덕션 유사 (`pnpm prod:up`) |
|------|---------------------------|--------------------------------|
| 서버 실행 | 로컬 Node.js (watch) | Docker 컨테이너 (production) |
| 빌드 | 실시간 컴파일 | 사전 빌드 (dist/) |
| 핫 리로드 | ✅ 지원 | ❌ 미지원 |
| 환경 파일 | `apps/server/.env` | `infra/env.prodlike` |
| DB/Redis | Docker Compose | Docker Compose |
| Flutter | 로컬 실행 | 별도 실행 필요 |
| 데이터 영속 | 볼륨 공유 | 볼륨 분리 |
| TEST_MODE | 선택 | **절대 false** |

---

## 📚 관련 문서

- [개발 환경 퀵스타트](./DEV_QUICKSTART.md)
- [Android 릴리즈](./RELEASE_ANDROID.md)
- [Server 릴리즈](./RELEASE_SERVER.md)
- [릴리즈 체크리스트](./RELEASE_CHECKLIST.md)
- [README](../README.md)

---

**마지막 업데이트**: 2025-12-20
