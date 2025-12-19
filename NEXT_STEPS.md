# 🚀 GitHub 업로드 완료 - 다음 3단계

**현재 상태:** ✅ 로컬 Git 준비 완료 (main + RC 브랜치)

---

## ⚡ 지금 바로 할 정답 3줄

### 1️⃣ GitHub 빈 레포 생성 → Remote 연결 → Push

```powershell
# 1. GitHub 웹에서 빈 레포 생성 (README/gitignore 체크 해제)
# URL 복사: https://github.com/<USER>/<REPO>.git

# 2. Remote 연결
cd "C:\Users\Kyung\Mud Game"
git remote add origin https://github.com/<USER>/<REPO>.git

# 3. Main 브랜치 Push
git checkout main
git push -u origin main

# 4. RC 브랜치 Push
git checkout chore/release-candidate-v1
git push -u origin chore/release-candidate-v1
```

### 2️⃣ Android 4개 Secrets 등록

**GitHub 레포 → Settings → Secrets and variables → Actions**

| Secret Name | Value | 비고 |
|------------|-------|------|
| `ANDROID_KEYSTORE_BASE64` | keystore base64 | PowerShell로 변환 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 비밀번호 | 안전하게 보관 |
| `ANDROID_KEY_ALIAS` | `mud-key` | Keystore alias |
| `ANDROID_KEY_PASSWORD` | key 비밀번호 | 안전하게 보관 |

**Base64 변환 (PowerShell):**
```powershell
$bytes = [System.IO.File]::ReadAllBytes("C:\path\to\release-key.jks")
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
```

### 3️⃣ PR 생성 후 머지 → v1.0.0 태그로 릴리즈 실행

```powershell
# 1. GitHub에서 PR 생성
# Base: main, Compare: chore/release-candidate-v1
# Title: Release Candidate v1 (S1 Only)

# 2. PR 머지 (Squash and merge)

# 3. 태그 생성 및 Push
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Release v1.0.0 (S1 only)"
git push origin v1.0.0

# 4. GitHub Actions 확인
# - Release Server Image (Docker build + push)
# - Release Android Build (AAB artifact)
```

---

## 📋 완료 체크리스트

### GitHub 설정
- [ ] 빈 레포 생성 (README/gitignore 체크 해제)
- [ ] Remote 연결 (`git remote add origin`)
- [ ] Main 브랜치 push
- [ ] RC 브랜치 push

### Android Secrets
- [ ] Keystore 생성 (또는 기존 사용)
- [ ] Keystore base64 변환
- [ ] `ANDROID_KEYSTORE_BASE64` 등록
- [ ] `ANDROID_KEYSTORE_PASSWORD` 등록
- [ ] `ANDROID_KEY_ALIAS` 등록
- [ ] `ANDROID_KEY_PASSWORD` 등록

### PR 및 릴리즈
- [ ] PR 생성 (main ← chore/release-candidate-v1)
- [ ] PR 머지
- [ ] v1.0.0 태그 생성 및 push
- [ ] GitHub Actions 성공 확인
  - [ ] Release Server Image
  - [ ] Release Android Build

---

## 🔍 리스크 체크

### ⚠️ Health Endpoint Timestamp 확인

**확인 방법:**
```powershell
# prod-like 환경 실행
pnpm prod:up

# Health check (여러 번 호출)
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/health
```

**정상:** `timestamp` 값이 매번 변경됨  
**문제:** `timestamp`가 고정값 (1734700000000 등)

> 현재 코드는 `Date.now()`를 사용하므로 정상입니다.

---

## 📚 참고 문서

- [GITHUB_SETUP_GUIDE.md](./GITHUB_SETUP_GUIDE.md) (상세 단계별 가이드)
- [RELEASE_CANDIDATE_V1_REPORT.md](./RELEASE_CANDIDATE_V1_REPORT.md)
- [RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md)
- [RELEASE_ANDROID.md](./docs/RELEASE_ANDROID.md)
- [RELEASE_SERVER.md](./docs/RELEASE_SERVER.md)

---

## 🎯 성공 기준

### 릴리즈 워크플로우 실전 통과

**Server Image Build:**
```
✅ Content validation PASS
✅ Catalog sync + diff check PASS
✅ Docker image build SUCCESS
✅ Push to GHCR SUCCESS
```

**Android AAB Build:**
```
✅ Keystore 복원 SUCCESS
✅ AAB 빌드 SUCCESS
✅ Artifact 업로드 SUCCESS
```

---

**완료 시점:** 모든 체크리스트 완료 + GitHub Actions 통과 ✅

