# 🔧 CI 실패 해결 가이드

## 📊 현재 상태

GitHub Actions에서 CI 워크플로우가 모두 실패하고 있습니다.
- 최근 실행: `381eeb4` - "chore: re-enable CI workflows" (52초 소요, 실패)

---

## 🔍 실패 원인 확인 방법

### 1. GitHub Actions 로그 확인
1. GitHub 레포 → **Actions** 탭
2. 실패한 워크플로우 클릭 (예: "CI #5")
3. 실패한 Job 클릭 (예: "CI Quality Gates")
4. 실패한 Step 확인

### 2. 일반적인 실패 원인

#### A. Prisma 관련
- **증상**: `prisma generate` 또는 `prisma migrate deploy` 실패
- **원인**: 
  - Prisma 스키마 오류
  - 마이그레이션 파일 누락
- **해결**: 로컬에서 `pnpm --filter server prisma generate` 실행 후 확인

#### B. Content Validation 실패
- **증상**: `content:validate` 단계 실패
- **원인**: 
  - `quests.json`, `items.json` 등 콘텐츠 파일 오류
  - 필수 퀘스트 누락 (예: `Q_S01_D02`)
- **해결**: 로컬에서 `pnpm content:validate` 실행 후 오류 확인

#### C. Catalog Sync Diff
- **증상**: "Catalog sync produced diff" 오류
- **원인**: 
  - `mud_client/assets/catalog/items_catalog.json`이 최신이 아님
- **해결**: 
  ```powershell
  pnpm catalog:sync
  git add mud_client/assets/catalog/items_catalog.json
  git commit -m "chore: update catalog"
  git push
  ```

#### D. Smoke Test 실패
- **증상**: `pnpm --filter server smoke` 실패
- **원인**: 
  - 테스트 코드 오류
  - DB 연결 문제
  - WebSocket 연결 문제
- **해결**: 로컬에서 `pnpm --filter server smoke` 실행 후 확인

#### E. Flutter Analyze 실패
- **증상**: `flutter analyze` 실패
- **원인**: 
  - Dart 코드 오류
  - 린터 규칙 위반
- **해결**: 로컬에서 `cd mud_client && flutter analyze` 실행 후 오류 수정

---

## 🚀 빠른 해결 체크리스트

### 1단계: 로컬에서 검증
```powershell
# 1. Prisma 확인
pnpm --filter server prisma generate

# 2. Content 검증
pnpm content:validate

# 3. Catalog 동기화
pnpm catalog:sync
git status  # diff 확인

# 4. Smoke 테스트
pnpm --filter server smoke

# 5. Flutter 분석
cd mud_client
flutter analyze
```

### 2단계: 문제 발견 시 수정
- 오류 메시지 확인
- 파일 수정
- 커밋 및 푸시

### 3단계: CI 재실행
- GitHub Actions에서 "Re-run jobs" 클릭
- 또는 새로운 커밋 푸시

---

## 📝 CI 워크플로우 단계별 설명

```yaml
1. Checkout - 코드 체크아웃
2. Setup Node.js - Node.js 20 설치
3. Setup pnpm - pnpm 9 설치
4. Install dependencies - pnpm install
5. Generate Prisma Client - Prisma 클라이언트 생성
6. Wait for PostgreSQL - DB 준비 대기
7. Prisma migrate deploy - 마이그레이션 적용
8. Prisma seed - 시드 데이터 생성
9. Content validation - 콘텐츠 검증
10. Catalog sync - 카탈로그 동기화
11. Check catalog diff - diff 확인 (0이어야 함)
12. Smoke test - E2E 테스트
13. Setup Flutter - Flutter 설치
14. Flutter pub get - 의존성 설치
15. Flutter analyze - 코드 분석
```

---

## 🎯 다음 단계

1. **GitHub Actions 로그 확인**
   - 실패한 Step 정확히 파악

2. **로컬에서 재현**
   - 동일한 명령어 실행
   - 오류 메시지 확인

3. **수정 후 재커밋**
   - 문제 해결
   - 커밋 및 푸시

---

**작성일:** 2025-12-21  
**상태:** CI 실패 원인 분석 필요

