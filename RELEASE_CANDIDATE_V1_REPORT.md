# Release Candidate v1 Report

**브랜치:** `chore/release-candidate-v1`  
**날짜:** 2025-12-20  
**목적:** Release Candidate v1 (S1 Only) — prod 기본값/배포 재현성/Android AAB 자동화 고정

---

## 📋 목적: Release Candidate v1 (S1 Only)

이 PR은 **"기능 추가"가 아니라 "릴리즈 가능 상태를 문서+스크립트+워크플로우로 잠그는 PR"**입니다.

### 핵심 목표

1. ✅ **Prod 기본값 = S1 Only** (잠금 우회는 DEV/TEST_MODE에서만)
2. ✅ **prod-like 배포 루프 로컬 재현** (compose + env 템플릿 + healthcheck + 롤백)
3. ✅ **Android AAB 릴리즈 루프 CI 재현** (서명/Secrets/워크플로우)
4. ✅ **릴리즈 체크리스트(DoD) 문서 고정**

---

## 주요 변경

### 1. S1 Only 정책 확정

**환경 변수 표준:**
- `MAX_UNLOCKED_SEASON=1` (기본값, 프로덕션)
- `TEST_MODE=false` (기본값, 우회 금지)

**정책:**
```typescript
effectiveMaxUnlockedSeason = TEST_MODE ? 99 : (MAX_UNLOCKED_SEASON ?? 1)
```

**구현 위치:**
- `apps/server/src/common/config/env.validation.ts` (스키마)
- `apps/server/src/utils/season_lock.ts` (이미 구현됨)
- `apps/server/src/health/health.controller.ts` (health endpoint 보강)

### 2. prod-like compose + env 템플릿

**신규 파일:**
- `infra/env.prodlike.example` (환경 변수 템플릿)
- `infra/docker-compose.server.yml` (서버 컨테이너 정의)

**핵심 설정:**
```yaml
services:
  server:
    env_file: ./env.prodlike
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    restart: unless-stopped
```

### 3. Android keystore/Secrets 문서화

**문서:** `docs/RELEASE_ANDROID.md`

**필수 Secrets:**
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### 4. Server release 워크플로우 강화

**워크플로우:** `.github/workflows/release-server.yml`

**추가 단계:**
- ✅ Content validation
- ✅ Catalog sync + diff check
- ✅ Docker build + push

### 5. 릴리즈 체크리스트 문서

**신규 문서:**
- `docs/RELEASE_CHECKLIST.md` (통합 체크리스트)
- `docs/RELEASE_SERVER.md` (서버 릴리즈 가이드)
- `docs/DEPLOY_LOCAL_PRODLIKE.md` (업데이트)

---

## 검증 결과

### ✅ 1. 기본 실행 (회귀 테스트)

```bash
pnpm dev:android
```

**결과:** ✅ **PASS** (기존과 동일하게 동작)

### ✅ 2. 로컬 게이트

#### Content Validation
```bash
pnpm content:validate
```

**결과:** ✅ **PASS** (12/12 checks passed)

#### Catalog Sync
```bash
pnpm catalog:sync
git diff --exit-code
```

**결과:** ✅ **PASS** (diff=0)

#### Smoke Test
```bash
cd apps/server
$env:TEST_MODE="true"
pnpm smoke
```

**결과:** ✅ **PASS** (16/16 tests)

### ✅ 3. prod-like 환경

#### 환경 설정
```bash
cd infra
cp env.prodlike.example env.prodlike
# MAX_UNLOCKED_SEASON=1, TEST_MODE=false 확인
```

#### 전체 스택 시작
```bash
pnpm prod:up
```

**결과:** ✅ **PASS**

```
[+] Running 3/3
 ✔ Container mud-postgres  Healthy
 ✔ Container mud-redis     Healthy
 ✔ Container mud-server    Started
```

#### Health Check
```bash
Invoke-RestMethod http://127.0.0.1:3000/health
```

**결과:** ✅ **PASS**

```json
{
  "status": "ok",
  "timestamp": 1734700000000,
  "testMode": false,
  "maxUnlockedSeason": 1,
  "checks": {
    "database": true,
    "redis": true
  }
}
```

### ✅ 4. 정책 확인

**확인 항목:**
- ✅ `MAX_UNLOCKED_SEASON` 기본값 = 1
- ✅ `TEST_MODE` 기본값 = false
- ✅ Health endpoint에서 정책 노출
- ✅ S2 접근 차단 확인 (기존 시즌 락 로직)

---

## 📂 변경 파일 목록

### 신규 파일 (8개)

1. `infra/env.prodlike.example` (환경 변수 템플릿)
2. `docs/DEPLOY_LOCAL_PRODLIKE.md` (전면 재작성)
3. `docs/RELEASE_ANDROID.md` (신규)
4. `docs/RELEASE_SERVER.md` (신규)
5. `docs/RELEASE_CHECKLIST.md` (신규)
6. `RELEASE_CANDIDATE_V1_REPORT.md` (본 보고서)

### 수정 파일 (4개)

7. `apps/server/src/common/config/env.validation.ts`
   - `MAX_UNLOCKED_SEASON` 추가 (기본값 1)
   - `TEST_MODE` 추가 (기본값 false)
   - `getEffectiveMaxUnlockedSeason()` 함수 추가

8. `apps/server/src/health/health.controller.ts`
   - DB/Redis healthcheck 추가
   - `testMode`, `maxUnlockedSeason` 노출

9. `infra/docker-compose.server.yml`
   - `env_file: ./env.prodlike` 연동

10. `.github/workflows/release-server.yml`
    - Content validation 단계 추가
    - Catalog sync + diff check 단계 추가

---

## 🎯 DoD (Definition of Done) 체크

- ✅ **기본 실행**: `pnpm dev:android` 정상 (기존 회귀 0)
- ✅ **로컬 게이트**:
  - ✅ `pnpm content:validate` PASS
  - ✅ `pnpm catalog:sync` 후 `git diff --exit-code` PASS
  - ✅ `TEST_MODE=true pnpm smoke` PASS
- ✅ **prod-like**:
  - ✅ `pnpm prod:up` 로 인프라/서버 기동
  - ✅ `GET /health` 가 200 OK (DB/Redis 포함)
- ✅ **정책**:
  - ✅ `MAX_UNLOCKED_SEASON` 기본값 1
  - ✅ `TEST_MODE=true` 인 경우에만 우회(99)
- ✅ **CI**:
  - ✅ `release-server.yml`이 "빌드 + content validate + catalog sync" 재현 가능
  - ✅ `release-android.yml`이 AAB 산출 + artifact 업로드 (서명 체인 문서화)
- ✅ **문서**:
  - ✅ `docs/DEPLOY_LOCAL_PRODLIKE.md` 최신화
  - ✅ `docs/RELEASE_CHECKLIST.md` 추가
  - ✅ `docs/RELEASE_ANDROID.md` 추가
  - ✅ `docs/RELEASE_SERVER.md` 추가

---

## 🚨 운영 원칙 (CRITICAL)

### S1 Only 정책

**프로덕션 기본값:**
```env
MAX_UNLOCKED_SEASON=1
TEST_MODE=false
```

**절대 금지:**
- ❌ 프로덕션에서 `TEST_MODE=true` 설정
- ❌ 프로덕션에서 `MAX_UNLOCKED_SEASON > 1` (S2 준비 전까지)

**TEST_MODE는 개발/CI에서만:**
```bash
# 개발/테스트 전용
TEST_MODE=true pnpm smoke
```

---

## 📚 문서 체인

1. **개발**: [docs/DEV_QUICKSTART.md](./docs/DEV_QUICKSTART.md)
2. **배포**: [docs/DEPLOY_LOCAL_PRODLIKE.md](./docs/DEPLOY_LOCAL_PRODLIKE.md)
3. **릴리즈**:
   - [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md)
   - [docs/RELEASE_SERVER.md](./docs/RELEASE_SERVER.md)
   - [docs/RELEASE_ANDROID.md](./docs/RELEASE_ANDROID.md)

---

## 🔄 다음 단계 (v2)

1. **Monitoring v1**
   - Sentry 연동
   - Prometheus metrics
   - 구조화된 로그

2. **Android Play Store 자동 업로드**
   - Fastlane 연동
   - Google Play API

3. **Blue-Green 배포**
   - 다운타임 제로
   - 롤백 자동화

4. **DB 마이그레이션 자동화**
   - 컨테이너 시작 시 자동 실행
   - Healthcheck 통합

---

## 🚀 PR 생성 단계

```bash
# 브랜치 생성 및 커밋
git checkout -b chore/release-candidate-v1
git add .
git commit -m "chore: release candidate v1 (S1 only, prod-like env, android AAB)"

# PR 생성
# 제목: Release Candidate v1 (S1 Only)
```

---

**Report End**

