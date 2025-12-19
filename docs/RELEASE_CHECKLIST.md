# 릴리즈 체크리스트

MUD 게임의 Server 및 Android 릴리즈를 위한 통합 체크리스트입니다.

---

## 🎯 버전 태그 규칙

### Semantic Versioning

```
vMAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes (DB 스키마, 프로토콜 변경)
- **MINOR**: 새 기능 추가 (하위 호환)
- **PATCH**: 버그 수정

**예시:**
- `v1.0.0`: 최초 릴리즈
- `v1.0.1`: 버그 수정
- `v1.1.0`: S2 콘텐츠 추가
- `v2.0.0`: WS 프로토콜 변경

### Android 전용 태그

```
android-vMAJOR.MINOR.PATCH
```

**예시:**
- `android-v1.0.0`: Android 앱 최초 릴리즈
- `android-v1.0.1`: Android 버그 수정

---

## 📋 릴리즈 전 체크리스트

### 공통 (Server + Android)

- [ ] **버전 결정**
  - Semantic Versioning 규칙 준수
  - `pubspec.yaml` (Android) 버전 증가
  - Release notes 작성

- [ ] **Content 검증**
  ```bash
  pnpm content:validate
  ```

- [ ] **Catalog 동기화**
  ```bash
  pnpm catalog:sync
  git diff --exit-code  # 변경 사항 없어야 함
  ```

- [ ] **Smoke 테스트**
  ```bash
  cd apps/server
  $env:TEST_MODE="true"
  pnpm smoke
  ```

- [ ] **정책 확인**
  - `MAX_UNLOCKED_SEASON=1` (S1 Only)
  - `TEST_MODE=false` (프로덕션)

### Server 전용

- [ ] **Docker 이미지 빌드 테스트**
  ```bash
  pnpm docker:build:server
  ```

- [ ] **DB 백업 (프로덕션)**
  ```bash
  docker exec mud-postgres pg_dump -U mud mud > backup-$(date +%Y%m%d).sql
  ```

- [ ] **마이그레이션 계획**
  - Prisma 마이그레이션 파일 확인
  - 다운타임 필요 여부 확인
  - 롤백 SQL 준비

- [ ] **Health Endpoint 확인**
  ```bash
  curl http://localhost:3000/health
  ```

### Android 전용

- [ ] **Flutter Analyze**
  ```bash
  cd mud_client
  flutter analyze
  ```

- [ ] **Keystore/Secrets 확인**
  - GitHub Secrets 등록 확인
  - Keystore 백업 확인

- [ ] **로컬 Release 빌드 테스트**
  ```bash
  cd mud_client
  flutter build appbundle --release
  ```

---

## 🚀 Server 릴리즈

### 1. 이미지 빌드 & 푸시

**자동 (권장):**
```bash
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions 자동 실행
# 확인: https://github.com/<owner>/<repo>/actions
```

**수동 (필요 시):**
1. GitHub Actions → "Release Server Image"
2. "Run workflow" → tag 입력 → 실행

### 2. 마이그레이션 배포

> ⚠️ **중요**: 서버 배포 전에 마이그레이션 실행

```bash
# 프로덕션 환경에서
docker exec mud-server npx prisma migrate deploy
```

### 3. 서버 재시작

**로컬/Staging:**
```bash
pnpm prod:down
pnpm prod:up
```

**프로덕션 (Fly.io 예시):**
```bash
fly deploy
```

### 4. 배포 후 확인

- [ ] **Health Check**
  ```bash
  curl https://<server-url>/health
  # status: "ok" 확인
  # testMode: false 확인
  # maxUnlockedSeason: 1 확인
  ```

- [ ] **기능 테스트**
  - 회원가입/로그인
  - 퀘스트 수락/제출
  - 상점 구매
  - 전투 진행

- [ ] **모니터링**
  - 에러율 확인
  - 응답 시간 확인
  - 로그 확인

---

## 📱 Android 릴리즈

### 1. AAB 빌드

**자동 (권장):**
```bash
git tag android-v1.0.0
git push origin android-v1.0.0

# GitHub Actions 자동 실행
```

**수동:**
1. GitHub Actions → "Release Android Build"
2. "Run workflow" → build mode: `release` → 실행

### 2. Artifact 다운로드

1. Actions → 해당 워크플로우 실행
2. Artifacts → `mud-game-aab-<sha>` 다운로드
3. 압축 해제 → `app-release.aab` 확인

### 3. Google Play Console 업로드

1. [Play Console](https://play.google.com/console) 접속
2. Production → Create new release
3. AAB 파일 업로드
4. Release notes 작성:
   ```
   v1.0.0 릴리즈 노트:
   - S1 콘텐츠 추가
   - 버그 수정
   - 성능 개선
   ```
5. Review → Start rollout

### 4. 배포 후 확인

- [ ] **설치 테스트** (실기기)
- [ ] **기본 플로우 확인**
  - 로그인
  - 퀘스트 진행
  - 상점 접근
  - S2 접근 차단 확인

---

## 🔄 롤백 체크리스트

### Server 롤백

- [ ] **이미지 태그 변경**
  ```yaml
  # docker-compose.server.yml
  image: ghcr.io/<owner>/<repo>/server:v1.0.0  # 이전 버전
  ```

- [ ] **서버 재시작**
  ```bash
  pnpm prod:down
  pnpm prod:up
  ```

- [ ] **DB 복원 (필요 시)**
  ```bash
  cat backup-20251220.sql | docker exec -i mud-postgres psql -U mud mud
  ```

- [ ] **Health Check 재확인**

### Android 롤백

> ⚠️ Google Play는 롤백 불가. 새 버전으로 수정 배포 필요.

- [ ] **긴급 패치 빌드**
- [ ] **새 버전 업로드** (v1.0.2 등)

---

## 📊 릴리즈 후 모니터링 (24시간)

### Server

- [ ] **에러율 모니터링**
  - 목표: < 1%
  - Sentry (v2)

- [ ] **응답 시간**
  - 목표: p95 < 500ms
  - Prometheus (v2)

- [ ] **리소스 사용률**
  - CPU < 80%
  - Memory < 80%

- [ ] **로그 확인**
  ```bash
  pnpm prod:logs
  ```

### Android

- [ ] **크래시율** (Play Console)
  - 목표: < 0.5%

- [ ] **ANR율**
  - 목표: < 0.1%

- [ ] **사용자 리뷰 모니터링**

---

## 🚨 긴급 대응 절차

### Critical Bug 발견

1. **즉시 통보** (팀 채널)
2. **영향 범위 파악**
   - 전체 사용자?
   - 특정 기능?
3. **긴급도 판단**
   - P0: 즉시 롤백
   - P1: 핫픽스 배포 (1-2시간)
   - P2: 다음 배포 포함

### 롤백 결정 기준

**즉시 롤백:**
- 데이터 손실 위험
- 앱 크래시 (crash rate > 5%)
- 보안 이슈

**핫픽스 배포:**
- 특정 기능 오류
- UI 버그
- 성능 저하

---

## 📚 릴리즈 문서 체인

1. [Server 릴리즈 가이드](./RELEASE_SERVER.md)
2. [Android 릴리즈 가이드](./RELEASE_ANDROID.md)
3. [프로덕션 배포 가이드](./DEPLOY_LOCAL_PRODLIKE.md)
4. [개발 환경 가이드](./DEV_QUICKSTART.md)

---

## 📝 릴리즈 노트 템플릿

```markdown
# v1.0.0 Release Notes

**릴리즈 날짜**: 2025-12-20

## 🎉 새로운 기능
- S1 콘텐츠 추가 (퀘스트 49개)
- 상점 시스템 추가

## 🐛 버그 수정
- 전투 타임아웃 이슈 해결
- 퀘스트 진행 동기화 수정

## 🔧 개선 사항
- Health endpoint 추가
- Docker 이미지 최적화 (450MB)

## ⚠️ 주의 사항
- MAX_UNLOCKED_SEASON=1 (S1 Only)
- 마이그레이션 필요

## 🔗 링크
- Server Image: ghcr.io/<owner>/<repo>/server:v1.0.0
- Android AAB: [Artifacts](https://github.com/<owner>/<repo>/actions)
```

---

**마지막 업데이트**: 2025-12-20

