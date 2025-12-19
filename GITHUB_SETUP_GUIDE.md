# GitHub 업로드 및 릴리즈 설정 가이드

**완료 시점:** 로컬 Git 초기화 및 브랜치 생성 완료

---

## ✅ 1. 사전 점검 완료

- ✅ Git repository 초기화 완료
- ✅ `.gitignore` 설정 완료 (민감 파일 제외)
- ✅ `main` 브랜치 커밋 완료
- ✅ `chore/release-candidate-v1` 브랜치 생성 완료

---

## 🚀 2. GitHub 빈 레포 생성

### 2.1 GitHub 웹사이트 접속

1. https://github.com 로그인
2. 우측 상단 **+** → **New repository** 클릭

### 2.2 레포지토리 설정

**필수 설정:**
- Repository name: `mud-game` (원하는 이름으로)
- Description: `턴제 텍스트 MUD 게임 - NestJS + Flutter`
- Visibility: **Private** (권장) 또는 Public

**⚠️ 중요: 빈 레포로 생성**
- ❌ Add a README file (체크 해제)
- ❌ Add .gitignore (체크 해제)
- ❌ Choose a license (None)

### 2.3 Create repository

버튼 클릭 후 나오는 **HTTPS URL 복사**:
```
https://github.com/<USER>/<REPO>.git
```

---

## 🔗 3. 로컬 레포를 GitHub에 연결

### 3.1 Remote 추가

```powershell
cd "C:\Users\Kyung\Mud Game"
git remote add origin https://github.com/<USER>/<REPO>.git
git remote -v
```

**예시:**
```
origin  https://github.com/kyungdev/mud-game.git (fetch)
origin  https://github.com/kyungdev/mud-game.git (push)
```

### 3.2 Main 브랜치 Push

```powershell
git checkout main
git push -u origin main
```

**예상 결과:**
```
Enumerating objects: 226, done.
Counting objects: 100% (226/226), done.
...
To https://github.com/<USER>/<REPO>.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

### 3.3 RC 브랜치 Push

```powershell
git checkout chore/release-candidate-v1
git push -u origin chore/release-candidate-v1
```

---

## 📝 4. GitHub에서 PR 생성

### 4.1 PR 페이지 이동

GitHub 레포지토리 → **Pull requests** → **New pull request**

### 4.2 브랜치 선택

- **Base:** `main`
- **Compare:** `chore/release-candidate-v1`

### 4.3 PR 정보 입력

**Title:**
```
Release Candidate v1 (S1 Only)
```

**Description:**
```markdown
## 목적: Release Candidate v1 (S1 Only)

prod 기본값/배포 재현성/Android AAB 자동화 고정

## 주요 변경

- ✅ S1 only 정책 기본값 확정: MAX_UNLOCKED_SEASON=1, TEST_MODE=true에서만 우회
- ✅ prod-like compose + env 템플릿 + healthcheck + runbook 추가
- ✅ Android keystore/Secrets 문서화 + AAB 빌드 워크플로우 재현 가능화
- ✅ Server release 워크플로우 재현 가능화(이미지 빌드/푸시)
- ✅ 릴리즈 체크리스트 문서 고정

## 검증

- ✅ pnpm dev:android
- ✅ pnpm content:validate
- ✅ pnpm catalog:sync && git diff --exit-code
- ✅ TEST_MODE=true pnpm smoke
- ✅ pnpm prod:up + health endpoint 200

## 문서

- [RELEASE_CANDIDATE_V1_REPORT.md](./RELEASE_CANDIDATE_V1_REPORT.md)
- [RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md)
- [DEPLOY_LOCAL_PRODLIKE.md](./docs/DEPLOY_LOCAL_PRODLIKE.md)
```

### 4.4 Create Pull Request

버튼 클릭 (아직 머지하지 않음)

---

## 🔐 5. Android Secrets 설정 (필수)

### 5.1 Keystore 생성 (최초 1회)

**이미 있으면 스킵**

```powershell
keytool -genkey -v -keystore release-key.jks -alias mud-key -keyalg RSA -keysize 2048 -validity 10000
```

**입력 정보 기록:**
- Keystore password: (안전하게 보관!)
- Key password: (안전하게 보관!)
- Key alias: `mud-key`

### 5.2 Keystore를 Base64로 변환

```powershell
$bytes = [System.IO.File]::ReadAllBytes("C:\path\to\release-key.jks")
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
Write-Host "Keystore base64 복사 완료 (클립보드)"
```

### 5.3 GitHub Secrets 등록

**GitHub 레포지토리 → Settings → Secrets and variables → Actions → New repository secret**

**필수 4개 Secrets:**

| Secret Name | Value |
|------------|-------|
| `ANDROID_KEYSTORE_BASE64` | (위에서 복사한 base64 문자열) |
| `ANDROID_KEYSTORE_PASSWORD` | (keystore password) |
| `ANDROID_KEY_ALIAS` | `mud-key` |
| `ANDROID_KEY_PASSWORD` | (key password) |

각 Secret 등록 후 **Add secret** 클릭

---

## ✅ 6. PR 머지

### 6.1 PR 페이지에서 확인

- Files changed 확인
- CI 통과 확인 (workflow가 있다면)

### 6.2 Merge Pull Request

**Merge method:** Squash and merge (권장)

**Confirm squash and merge** 클릭

### 6.3 브랜치 정리 (선택)

- Delete branch `chore/release-candidate-v1` (GitHub UI에서)

---

## 🏷️ 7. 릴리즈 태그 생성 및 워크플로우 실행

### 7.1 Main 브랜치 업데이트

```powershell
git checkout main
git pull origin main
```

### 7.2 릴리즈 태그 생성

```powershell
git tag -a v1.0.0 -m "Release v1.0.0 (S1 only)"
git push origin v1.0.0
```

### 7.3 GitHub Actions 확인

**GitHub 레포지토리 → Actions**

**자동 실행되는 워크플로우:**

1. **Release Server Image**
   - Content validation
   - Catalog sync + diff check
   - Docker build + push to GHCR
   - **성공 기준:** ✅ Image pushed

2. **Release Android Build**
   - Flutter setup
   - Keystore 복원
   - AAB 빌드
   - Artifact 업로드
   - **성공 기준:** ✅ AAB artifact 생성

---

## 🔍 8. 최종 검증

### 8.1 Server Image 확인

```powershell
# GHCR 이미지 확인
# https://github.com/<USER>/<REPO>/pkgs/container/mud-game%2Fserver
```

### 8.2 Android AAB 다운로드

1. GitHub → Actions → "Release Android Build" 워크플로우
2. 해당 실행 클릭
3. Artifacts → `mud-game-aab-<sha>` 다운로드

### 8.3 Health Endpoint 확인 (prod-like)

```powershell
# 로컬에서 prod-like 환경 실행
pnpm prod:up

# Health check
Invoke-RestMethod http://127.0.0.1:3000/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": 1734700000000,  // 호출할 때마다 변경됨
  "testMode": false,
  "maxUnlockedSeason": 1,
  "checks": {
    "database": true,
    "redis": true
  }
}
```

---

## 🎉 완료!

### 달성한 것

- ✅ GitHub 레포지토리 생성 및 코드 업로드
- ✅ PR 생성 및 머지
- ✅ Android Secrets 설정
- ✅ v1.0.0 릴리즈 태그 생성
- ✅ Release workflows 실전 통과
- ✅ Server Docker 이미지 GHCR 푸시
- ✅ Android AAB artifact 생성

### 다음 단계 (선택)

1. **프로덕션 배포**
   - Fly.io / Render / AWS ECS 중 선택
   - [RELEASE_SERVER.md](./docs/RELEASE_SERVER.md) 참조

2. **Google Play 업로드**
   - Play Console에서 AAB 수동 업로드
   - [RELEASE_ANDROID.md](./docs/RELEASE_ANDROID.md) 참조

3. **모니터링 설정**
   - Sentry 연동
   - Prometheus metrics

---

**작성일:** 2025-12-20  
**참조:** [RELEASE_CANDIDATE_V1_REPORT.md](./RELEASE_CANDIDATE_V1_REPORT.md)

