# Server 릴리즈 가이드

MUD 게임 서버의 Docker 이미지 빌드, 배포, 롤백 가이드입니다.

---

## 🎯 목표

- ✅ Docker 이미지 빌드 및 푸시
- ✅ GitHub Container Registry (GHCR) 사용
- ✅ 버전 태깅 전략
- ✅ 마이그레이션 안전 배포
- ✅ 롤백 전략

---

## 🏗️ 이미지 레지스트리

**GitHub Container Registry (GHCR):**
- Registry: `ghcr.io`
- Image: `ghcr.io/<owner>/<repo>/server`
- Public/Private: Repository 설정에 따름

---

## 🏷️ 태깅 전략

### 자동 태그

| 트리거 | 태그 | 설명 |
|-------|------|------|
| `v1.0.0` | `v1.0.0`, `latest` | Semantic version tag |
| `main` push | `main-<sha>` | Main 브랜치 SHA |
| Manual | `<input-tag>` | workflow_dispatch 입력 |

### 버전 규칙

**Semantic Versioning:**
```
vMAJOR.MINOR.PATCH
v1.0.0, v1.0.1, v1.1.0, v2.0.0
```

- **MAJOR**: Breaking changes (DB 스키마 변경, 프로토콜 변경)
- **MINOR**: 새 기능 추가 (하위 호환)
- **PATCH**: 버그 수정

---

## 🤖 GitHub Actions 자동 빌드

### 워크플로우: `.github/workflows/release-server.yml`

**트리거:**
- `workflow_dispatch` (수동 실행)
- `push tags: v*` (예: `v1.0.0`)

### 수동 실행

1. GitHub 저장소 → Actions → "Release Server Image"
2. "Run workflow" 클릭
3. Image tag 입력 (선택, 기본값: `latest`)
4. "Run workflow" 실행

### 태그로 자동 실행

```bash
# 버전 태그 생성
git tag v1.0.0
git push origin v1.0.0

# 자동으로 워크플로우 실행됨
# 이미지 태그: v1.0.0, latest
```

### 워크플로우 단계

1. ✅ Content validation (`pnpm content:validate`)
2. ✅ Catalog sync + diff check
3. ✅ Docker 이미지 빌드
4. ✅ GHCR 로그인
5. ✅ 이미지 푸시

---

## 🚀 로컬 빌드 (테스트용)

### Docker 이미지 빌드

```bash
# 루트 디렉터리에서
pnpm docker:build:server

# 또는
docker build -f apps/server/Dockerfile -t mud-server:local .
```

### 로컬 이미지 실행

```bash
# 단독 실행 (DB/Redis 별도 필요)
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=... \
  -e ADMIN_KEY=... \
  -e MAX_UNLOCKED_SEASON=1 \
  -e TEST_MODE=false \
  mud-server:local
```

**권장**: `pnpm prod:up` 사용 (전체 스택)

---

## 📦 배포 전략

### 1. 사전 검증 (로컬/CI)

```bash
# Content 검증
pnpm content:validate

# Catalog 동기화 확인
pnpm catalog:sync
git diff --exit-code

# Smoke 테스트
cd apps/server
$env:TEST_MODE="true"
pnpm smoke
```

### 2. 이미지 빌드 & 푸시

**자동 (GitHub Actions):**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**수동 (필요 시):**
```bash
docker build -f apps/server/Dockerfile -t ghcr.io/<owner>/<repo>/server:v1.0.0 .
docker push ghcr.io/<owner>/<repo>/server:v1.0.0
```

### 3. 마이그레이션 배포 정책

> ⚠️ **중요**: 마이그레이션은 서버 배포와 **별도 단계**로 처리

**마이그레이션 우선 방식:**
```bash
# 1. 마이그레이션 먼저 실행
docker exec mud-server npx prisma migrate deploy

# 2. 서버 재시작
docker-compose restart server
```

**Rolling Update 방식 (프로덕션):**
```bash
# 1. 마이그레이션 실행 (다운타임 없이)
# 2. 서버 이미지 업데이트 (점진적)
# 3. Health check 확인
```

### 4. Health Check 확인

```bash
# 배포 후 확인
curl http://<server-url>/health

# 예상 응답:
# {
#   "status": "ok",
#   "timestamp": ...,
#   "testMode": false,
#   "maxUnlockedSeason": 1,
#   "checks": { "database": true, "redis": true }
# }
```

---

## 🔄 롤백 전략

### 1. 이미지 태그 변경

**Docker Compose:**

`infra/docker-compose.server.yml` 수정:

```yaml
services:
  server:
    image: ghcr.io/<owner>/<repo>/server:v1.0.0  # 이전 버전으로
    # build: ... 주석 처리
```

```bash
pnpm prod:down
pnpm prod:up
```

### 2. DB 마이그레이션 롤백

**Prisma 정책:**
- Prisma는 자동 롤백을 지원하지 않음
- 수동 SQL 또는 백업 복원 필요

**백업 전략 (권장):**
```bash
# 배포 전 백업
docker exec mud-postgres pg_dump -U mud mud > backup-$(date +%Y%m%d).sql

# 롤백 시 복원
cat backup-20251220.sql | docker exec -i mud-postgres psql -U mud mud
```

### 3. Blue-Green 배포 (v2 예정)

두 개의 환경을 유지하여 롤백 최소화:
- Blue: 현재 운영 환경
- Green: 새 버전 배포 환경

---

## 🔧 프로덕션 배포 예시

### Fly.io 배포

```bash
# fly.toml 설정 (루트)
fly launch

# 환경 변수 설정
fly secrets set JWT_SECRET=...
fly secrets set ADMIN_KEY=...
fly secrets set MAX_UNLOCKED_SEASON=1
fly secrets set TEST_MODE=false

# 배포
fly deploy
```

### Render 배포

1. Render Dashboard → New → Web Service
2. 연결: GitHub repository
3. Docker 설정:
   - Dockerfile path: `apps/server/Dockerfile`
   - Context: Repository root
4. 환경 변수 설정
5. Deploy

### AWS ECS (고급)

1. ECR에 이미지 푸시
2. Task Definition 생성
3. Service 업데이트
4. ALB Health Check 설정

---

## 📋 배포 체크리스트

### 배포 전

- [ ] `pnpm content:validate` 통과
- [ ] `pnpm catalog:sync` 후 diff 0
- [ ] `TEST_MODE=true pnpm smoke` 통과
- [ ] 버전 태그 결정 (v1.0.0)
- [ ] Release notes 작성
- [ ] DB 백업 (프로덕션)

### 배포 중

- [ ] 이미지 빌드 성공
- [ ] 이미지 푸시 성공
- [ ] 마이그레이션 실행 (필요 시)
- [ ] Health check 응답 확인
- [ ] 로그 모니터링

### 배포 후

- [ ] 기능 테스트 (기본 플로우)
- [ ] 모니터링 확인 (에러율, 응답 시간)
- [ ] 롤백 계획 준비
- [ ] Git tag 푸시
- [ ] 릴리즈 노트 공개

---

## 🚨 긴급 롤백 시나리오

### 즉시 롤백 (5분 이내)

```bash
# 1. 이전 이미지로 즉시 전환
cd infra
docker-compose -f docker-compose.yml -f docker-compose.server.yml down
# docker-compose.server.yml에서 이미지 태그를 이전 버전으로 수정
docker-compose -f docker-compose.yml -f docker-compose.server.yml up -d

# 2. Health check
curl http://localhost:3000/health

# 3. 로그 확인
docker logs mud-server -f
```

### 마이그레이션 이슈

```bash
# DB 백업 복원
cat backup-20251220.sql | docker exec -i mud-postgres psql -U mud mud

# 서버 재시작
docker-compose restart server
```

---

## 📊 모니터링 (v2 예정)

### Sentry 연동

```typescript
// apps/server/src/main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Prometheus Metrics

```typescript
// Health endpoint 확장
@Get('metrics')
getMetrics() {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  };
}
```

---

## 📚 관련 문서

- [Android 릴리즈](./RELEASE_ANDROID.md)
- [릴리즈 체크리스트](./RELEASE_CHECKLIST.md)
- [프로덕션 배포](./DEPLOY_LOCAL_PRODLIKE.md)

---

**마지막 업데이트**: 2025-12-20

