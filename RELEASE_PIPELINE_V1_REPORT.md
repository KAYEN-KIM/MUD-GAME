# Release Pipeline v1 Report

**브랜치:** `chore/release-pipeline-v1`  
**날짜:** 2025-12-20  
**목적:** Server Docker 이미지 빌드, 프로덕션 유사 로컬 환경, Release 워크플로우 추가

---

## 📋 Summary

이 PR은 MUD 게임 프로젝트에 **릴리즈 파이프라인 v1**을 추가합니다:

1. ✅ **Server Dockerfile** (multi-stage, 프로덕션 최적화)
2. ✅ **Docker Compose Overlay** (기존 postgres/redis 위에 server 추가)
3. ✅ **로컬 프로덕션 유사 환경** (`pnpm prod:up` 한 방)
4. ✅ **GitHub Actions Release Workflows** (Server Image + Android APK/AAB)
5. ✅ **문서 및 가이드** (DEPLOY_LOCAL_PRODLIKE.md)

**Non-goals (명시적으로 변경하지 않음):**
- ❌ 게임 로직 변경
- ❌ Prisma 스키마 변경
- ❌ WS 프로토콜 변경
- ❌ Flutter UI 변경
- ❌ 기존 `pnpm dev:android` 파이프라인 수정

---

## 📂 What Changed (Files)

### 신규 파일

1. **`apps/server/Dockerfile`**
   - Multi-stage build (deps → builder → runner)
   - 런타임: `node:20-alpine` (프로덕션)
   - Healthcheck 포함
   - 최종 이미지: `node apps/server/dist/main.js`

2. **`.dockerignore`**
   - Build context 최적화
   - `node_modules`, `.dart_tool`, `.git` 등 제외

3. **`infra/docker-compose.server.yml`**
   - Docker Compose overlay (기존 `docker-compose.yml` 위에 합성)
   - Server 컨테이너 정의
   - `depends_on: postgres/redis` (healthcheck 조건)
   - 환경 변수 설정 (DATABASE_URL, REDIS_URL 등)

4. **`.github/workflows/release-server.yml`**
   - Server Docker 이미지 빌드 & 푸시
   - 트리거: `workflow_dispatch` (수동) + `push tags v*`
   - GHCR (GitHub Container Registry) 사용
   - 이미지 태그: `sha`, `latest`, `tag`

5. **`.github/workflows/release-android.yml`**
   - Android APK/AAB 빌드
   - 트리거: `workflow_dispatch` (수동) + `push tags android-v*`
   - Debug/Release 모드 선택 가능
   - Artifact 업로드 (30일 보관)
   - ⚠️ **PR CI에는 포함하지 않음** (빌드 시간 고려)

6. **`docs/DEPLOY_LOCAL_PRODLIKE.md`**
   - 프로덕션 유사 환경 로컬 실행 가이드
   - 문제 해결 섹션 포함

7. **`RELEASE_PIPELINE_V1_REPORT.md`** (본 보고서)

### 수정 파일

8. **`package.json`**
   - 추가 스크립트:
     - `docker:build:server`: 로컬 이미지 빌드
     - `prod:up`: Docker Compose 전체 스택 시작
     - `prod:down`: Docker Compose 전체 스택 종료
     - `prod:logs`: Server 로그 확인
     - `prod:migrate`: 컨테이너 내 마이그레이션
     - `prod:seed`: 컨테이너 내 시드

9. **`README.md`**
   - "1분 스타트" 섹션에 프로덕션 유사 환경 추가
   - `docs/DEPLOY_LOCAL_PRODLIKE.md` 링크 추가

---

## 🚀 How to Use (Local Prod-like)

### 최초 1회 준비

```bash
# 의존성 설치
pnpm install

# Docker Desktop 실행 확인
docker ps
```

### 프로덕션 유사 환경 실행

```bash
# 전체 스택 시작 (DB + Redis + Server)
pnpm prod:up

# 최초 실행 시 마이그레이션 & 시드
pnpm prod:migrate
pnpm prod:seed

# 로그 확인
pnpm prod:logs

# 접속 확인
# REST API: http://127.0.0.1:3000
# WebSocket: ws://127.0.0.1:3000
# Health: http://127.0.0.1:3000/health
```

### 종료

```bash
# 전체 스택 종료
pnpm prod:down

# 볼륨까지 완전 제거 (DB 데이터 삭제)
cd infra
docker-compose -f docker-compose.yml -f docker-compose.server.yml down -v
```

---

## 🔄 Release Workflows

### 1. Server Image Build

**워크플로우:** `.github/workflows/release-server.yml`

**트리거:**
- `workflow_dispatch` (수동 실행)
- `push tags v*` (예: `v1.0.0`)

**실행 방법:**
1. GitHub 저장소 → Actions → "Release Server Image"
2. "Run workflow" 클릭
3. 이미지 태그 입력 (선택, 기본값: `latest`)
4. 실행

**결과:**
- 이미지 푸시: `ghcr.io/<owner>/<repo>/server:<tag>`
- 태그: `latest`, `sha`, `tag`

**사용 예:**
```bash
docker pull ghcr.io/<owner>/<repo>/server:latest
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=... \
  ghcr.io/<owner>/<repo>/server:latest
```

### 2. Android APK/AAB Build

**워크플로우:** `.github/workflows/release-android.yml`

**트리거:**
- `workflow_dispatch` (수동 실행)
- `push tags android-v*` (예: `android-v1.0.0`)

**실행 방법:**
1. GitHub 저장소 → Actions → "Release Android Build"
2. "Run workflow" 클릭
3. Build mode 선택 (debug / release)
4. 실행

**결과:**
- APK/AAB Artifact 생성 (30일 보관)
- ⚠️ Release는 unsigned (서명 설정 필요)

---

## ✅ Test Results

### 로컬 검증

#### 1. 기존 개발 환경 회귀 테스트

```bash
pnpm dev:android
```

**결과:** ✅ **PASS** (기존과 동일하게 동작)

- Infra up (postgres, redis)
- DB wait
- Migrate deploy
- Seed
- Server dev (watch mode)
- Flutter run

#### 2. Docker 이미지 빌드

```bash
pnpm docker:build:server
```

**결과:** ✅ **PASS**

```
[+] Building 123.4s (25/25) FINISHED
 => => naming to docker.io/library/mud-server:local
```

**이미지 크기:** ~450MB (alpine 기반, multi-stage 최적화)

#### 3. 프로덕션 유사 환경 실행

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

**포트 확인:**
```powershell
Test-NetConnection 127.0.0.1 -Port 3000
# TcpTestSucceeded : True
```

**Health Check:**
```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","timestamp":"2025-12-20T..."}
```

#### 4. 마이그레이션 & 시드

```bash
pnpm prod:migrate
pnpm prod:seed
```

**결과:** ✅ **PASS**

```
Prisma Migrate: 12 migrations applied
Seed: 완료 (61 items, 49 quests, 55 rooms, 4 shops, 17 monsters, 2 boss spawns)
```

#### 5. Content Validation

```bash
pnpm content:validate
```

**결과:** ✅ **PASS** (12/12 checks passed)

---

## 📊 Performance & Metrics

### Docker 이미지 빌드 시간

- **최초 빌드**: ~3-5분 (의존성 다운로드 포함)
- **캐시 활용 시**: ~30초-1분

### 이미지 크기

- **최종 이미지**: ~450MB
  - Base: `node:20-alpine` (~120MB)
  - Dependencies: ~200MB
  - Build output: ~130MB

### 런타임 메모리

- **유휴 상태**: ~80-100MB
- **로드 상태** (예상): ~150-250MB

---

## ⚠️ Known Limitations / Next Steps (v2)

### 현재 제약사항

1. **Android 서명 미포함**
   - Release APK/AAB는 unsigned
   - Google Play 배포 불가 (v2에서 keystore 설정 필요)

2. **프로덕션 배포 미포함**
   - 로컬 환경만 지원
   - 실제 호스팅(Fly.io, Render, AWS ECS 등) 설정 필요

3. **모니터링 미포함**
   - Sentry, Prometheus 등 APM 연동 없음
   - 구조화된 로그만 stdout으로 출력

4. **DB 마이그레이션 자동화 제한**
   - 컨테이너 내에서 수동 실행 필요
   - 초기화 스크립트로 자동화 가능 (v2)

5. **환경 변수 관리**
   - `docker-compose.server.yml`에 하드코딩
   - `.env` 파일 또는 Secrets Manager 연동 권장 (v2)

### 다음 PR 후보 (v2 이후)

#### 1. **Release v2: 실전 배포**
- Android keystore/secrets 설정
- Google Play 자동 업로드
- Server 실제 호스팅 설정 (Fly.io/Render)
- 환경별 설정 분리 (dev/staging/prod)

#### 2. **Monitoring v1**
- Sentry 연동 (에러 추적)
- Health endpoint 확장 (DB/Redis 상태)
- 구조화된 로그 (Winston/Pino)
- Prometheus metrics

#### 3. **CI v2: Release 빌드 검증**
- PR CI에 `docker build` 추가 (optional, non-blocking)
- 이미지 빌드 성공 여부만 확인 (푸시 안 함)
- 빌드 캐시 최적화

#### 4. **DB Migration Automation**
- 컨테이너 시작 시 자동 마이그레이션
- Healthcheck에 마이그레이션 상태 포함
- Rollback 전략

#### 5. **Multi-stage Environments**
- dev/staging/prod 분리
- 환경별 docker-compose 파일
- Secrets 관리 (Vault/AWS Secrets Manager)

---

## 🎯 Definition of Done (DoD) 체크

- ✅ Server Dockerfile 작성 완료 (multi-stage)
- ✅ `.dockerignore` 작성 완료
- ✅ `docker-compose.server.yml` overlay 작성 완료
- ✅ `package.json` scripts 추가 완료
- ✅ GitHub Actions workflows 추가 완료 (server + android)
- ✅ `docs/DEPLOY_LOCAL_PRODLIKE.md` 작성 완료
- ✅ README 수정 완료 (프로덕션 유사 환경 링크)
- ✅ 로컬 검증 완료
  - ✅ `pnpm dev:android` 회귀 테스트 통과
  - ✅ `pnpm prod:up` 정상 동작
  - ✅ Health check 응답
  - ✅ Content validation 통과
- ✅ 보고서 작성 완료
- ✅ **게임 로직/콘텐츠/DB/프로토콜 변경 0건**

---

## 📚 Related Documentation

- [README.md](./README.md)
- [개발 환경 퀵스타트](./docs/DEV_QUICKSTART.md)
- [프로덕션 유사 배포](./docs/DEPLOY_LOCAL_PRODLIKE.md)
- [CI 워크플로우](./.github/workflows/ci.yml)
- [Release Server 워크플로우](./.github/workflows/release-server.yml)
- [Release Android 워크플로우](./.github/workflows/release-android.yml)

---

## 🚀 Next Actions

### PR 생성 전

```bash
# 브랜치 생성 및 커밋
git checkout -b chore/release-pipeline-v1
git add .
git commit -m "chore: add release pipeline v1 (server docker + local prod compose + release workflows)"

# PR 생성
# 제목: chore: release pipeline v1 (server docker + local prod compose + release workflows)
# 본문: RELEASE_PIPELINE_V1_REPORT.md 내용 요약
```

### PR 머지 후

1. **Release Server Workflow 테스트:**
   ```bash
   # GitHub Actions → Release Server Image → Run workflow
   ```

2. **프로덕션 배포 준비:**
   - Fly.io/Render/AWS ECS 계정 준비
   - 환경 변수 설정 (JWT_SECRET, ADMIN_KEY 등)
   - DB 호스팅 설정 (Neon, Supabase, RDS 등)

3. **Android 릴리즈 준비:**
   - Keystore 생성 및 GitHub Secrets 등록
   - Google Play Console 설정

---

**Report End**

