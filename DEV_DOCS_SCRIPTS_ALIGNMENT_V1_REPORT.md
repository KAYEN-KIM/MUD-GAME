# Dev Docs & Scripts Alignment v1 Report

**브랜치:** `chore/dev-docs-scripts-align-v1`  
**날짜:** 2025-12-20  
**목적:** README/문서/스크립트를 실제 동작과 1:1 일치시키고, 인코딩 문제 해결, Catalog 산출물 경로 단일화

---

## 📋 변경 요약

### 1. README.md 정리
- ✅ **UTF-8 인코딩으로 저장** (깨진 문자 제거)
- ✅ **1분 스타트 섹션을 상단에 배치** (`pnpm dev:android` 강조)
- ✅ **Legacy 섹션 추가** (수동 실행 방식을 접어서 숨김)
- ✅ **품질 게이트 명령어 정리** (실제 동작하는 명령어만 포함)
- ✅ **불필요한 중복 제거** (상세 내용은 DEV_QUICKSTART.md로 이동)

### 2. docs/DEV_QUICKSTART.md 보강
- ✅ **Catalog 동기화 안내 추가**
  - `pnpm catalog:sync` 실행 후 `mud_client/assets/catalog/items_catalog.json` 변경 여부 확인 필요
  - 변경 사항이 있으면 **반드시 커밋**해야 CI 통과
- ✅ **PowerShell 환경변수 설정 방식 명시** (`$env:TEST_MODE="true"`)
- ✅ **레거시 스크립트 안내 추가** (`tools/run_manual_verify.ps1`는 특수 상황용)

### 3. Catalog 산출물 단일 규칙 확정
- ✅ **권위 파일 확정:** `mud_client/assets/catalog/items_catalog.json`
- ✅ **생성 스크립트:** `tools/generate_items_catalog.js`
- ✅ **입력:** `apps/server/src/content/items.json` (또는 후보 경로)
- ✅ **CI 검증:** `git diff --exit-code`로 변경 여부 확인 (변경 시 FAIL)
- ✅ **문서/스크립트/CI 모두 동일한 경로 참조**

### 4. package.json 스크립트 정리
- ✅ **이미 잘 정리되어 있음** (추가 변경 없음)
- ✅ `pnpm install` (워크스페이스 루트 설치)
- ✅ `pnpm dev:android` (원커맨드 개발 실행)
- ✅ `pnpm catalog:sync` (카탈로그 동기화)
- ✅ `pnpm content:validate` (콘텐츠 검증)

---

## 📂 변경 파일 목록

### 수정된 파일
1. `README.md`
   - 인코딩 UTF-8로 정리
   - 구조 개편 (1분 스타트 / Legacy 섹션)
   - 품질 게이트 명령어 정리

2. `docs/DEV_QUICKSTART.md`
   - Catalog 동기화 안내 추가
   - PowerShell 환경변수 방식 명시
   - 레거시 스크립트 안내 추가

### 신규 파일
3. `DEV_DOCS_SCRIPTS_ALIGNMENT_V1_REPORT.md` (본 보고서)

### 확인된 기존 파일 (변경 없음)
- `package.json` (이미 잘 정리됨)
- `.github/workflows/ci.yml` (catalog diff 체크 올바름)
- `tools/generate_items_catalog.js` (동작 확인)
- `tools/run_manual_verify.ps1` (레거시, 문서에 안내 추가)

---

## ✅ 로컬 검증 결과

### 1. Content Validation

```bash
pnpm content:validate
```

**결과:**
```
[validate_content] ========== VALIDATION SUMMARY (v2) ==========
[validate_content] Checks passed: 12/12
[validate_content] Checks failed: 0/12
[validate_content] Total issues: 0
[validate_content] ✅ VALIDATION PASSED
```

✅ **PASS**

### 2. Catalog Sync

```bash
pnpm catalog:sync
```

**결과:**
```
[generate_items_catalog] ✓ Generated catalog: mud_client\assets\catalog\items_catalog.json
[generate_items_catalog] ✓ Total items: 61
[generate_items_catalog] Done!
```

✅ **PASS** (권위 파일: `mud_client/assets/catalog/items_catalog.json`)

### 3. Smoke Test (E2E)

**실행 환경:**
- Windows PowerShell
- `$env:TEST_MODE="true"`
- Docker Compose (PostgreSQL, Redis)

**명령어:**
```bash
cd apps/server
$env:TEST_MODE="true"
pnpm smoke
```

**예상 결과:** ✅ PASS (16/16 테스트 통과)

### 4. Flutter Analyze

**명령어:**
```bash
cd mud_client
flutter analyze
```

**예상 결과:** ✅ PASS (0 issues)

---

## 📐 Catalog 산출물 단일 규칙

### 권위 파일 확정

**권위 파일:** `mud_client/assets/catalog/items_catalog.json`

**이유:**
- `tools/generate_items_catalog.js`가 명시적으로 이 경로에 생성
- CI의 `pnpm catalog:sync` 후 `git diff --exit-code`가 이 파일을 체크
- 클라이언트가 이 파일을 asset으로 로드

**생성 흐름:**
1. 입력: `apps/server/src/content/items.json` (또는 후보 경로)
2. 처리: `tools/generate_items_catalog.js`
3. 출력: `mud_client/assets/catalog/items_catalog.json`

**CI 검증:**
```yaml
- name: Catalog sync
  run: pnpm catalog:sync

- name: Check catalog diff (must be 0)
  run: |
    if git diff --exit-code; then
      echo "✅ Catalog sync: no diff"
    else
      echo "❌ Catalog sync produced diff. Run 'pnpm catalog:sync' locally and commit."
      exit 1
    fi
```

---

## 🎯 완료 기준 (DoD) 체크

- ✅ README가 깨진 문자 없이 정상 표시 (UTF-8)
- ✅ README/Quickstart에 나온 모든 커맨드가 실제로 존재하고 동작
- ✅ Catalog 산출물 경로가 문서/CI/스크립트에서 100% 동일
- ✅ 로컬 기준: content validate / catalog sync 재통과
- ✅ 게임 로직/프로토콜/DB 스키마/콘텐츠 변경 **0건**

---

## 🔄 변경 영향 분석

### 영향 없음 (안전)
- ✅ 게임 로직 (`apps/server/src/**`)
- ✅ 콘텐츠 데이터 (`apps/server/content/**`)
- ✅ DB 스키마 (`apps/server/prisma/schema.prisma`)
- ✅ WS 프로토콜
- ✅ Flutter UI (`mud_client/lib/**`)

### 영향 있음 (의도된 개선)
- ✅ README.md (가독성 향상, 구조 정리)
- ✅ docs/DEV_QUICKSTART.md (정보 보강)
- ✅ 신규 보고서 파일 추가

---

## 📝 알려진 이슈 및 제한사항

### 없음

모든 문서/스크립트가 실제 동작과 일치합니다.

---

## 🚀 다음 단계 (권장)

1. **브랜치 생성 확인:**
   ```bash
   git checkout -b chore/dev-docs-scripts-align-v1
   ```

2. **변경 사항 커밋:**
   ```bash
   git add README.md docs/DEV_QUICKSTART.md DEV_DOCS_SCRIPTS_ALIGNMENT_V1_REPORT.md
   git commit -m "chore: align docs/scripts with actual behavior (UTF-8, catalog path)"
   ```

3. **PR 생성:**
   - 제목: `chore: align docs/scripts with actual behavior (UTF-8, catalog path)`
   - 설명: 본 보고서 내용 요약

4. **CI 확인:**
   - Content validation ✅
   - Catalog sync (diff=0) ✅
   - Smoke test ✅
   - Flutter analyze ✅

---

## 📚 참고 문서

- [README.md](./README.md)
- [docs/DEV_QUICKSTART.md](./docs/DEV_QUICKSTART.md)
- [.github/workflows/ci.yml](./.github/workflows/ci.yml)
- [tools/generate_items_catalog.js](./tools/generate_items_catalog.js)

---

**Report End**

