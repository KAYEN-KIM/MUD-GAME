# ===== ONE-SHOT: 브랜치 비교/PR 가능 여부/CI 비활성화 여부 점검 =====
$ErrorActionPreference = "Stop"

Write-Host "== MUD-GAME 원샷 점검 시작 =="

# 0) 현재 폴더가 git 레포인지 확인
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: 현재 폴더가 git 레포가 아니다. 레포 루트로 이동해서 다시 실행해라."
  exit 1
}

# 1) 원격 최신 가져오기
Write-Host "`n[1] git fetch origin"
git fetch origin

# 2) 주요 해시 출력
$mainHash   = (git rev-parse origin/main).Trim()
$rcHash     = (git rev-parse origin/chore/release-candidate-v1).Trim()
$headBranch = (git branch --show-current).Trim()
$headHash   = (git rev-parse HEAD).Trim()

Write-Host "`n[2] 해시 상태"
Write-Host "  HEAD branch : $headBranch"
Write-Host "  HEAD hash   : $headHash"
Write-Host "  origin/main : $mainHash"
Write-Host "  origin/RC   : $rcHash"

# 3) ahead/behind 계산 (왼쪽=main만, 오른쪽=RC만)
# 형식: "<main_only_count> <rc_only_count>"
$counts = (git rev-list --left-right --count origin/main...origin/chore/release-candidate-v1).Trim()
$parts = $counts -split "\s+"
$mainOnlyCount = [int]$parts[0]
$rcOnlyCount   = [int]$parts[1]

Write-Host "`n[3] ahead/behind 요약"
Write-Host "  main에만 있는 커밋 수(main-only): $mainOnlyCount"
Write-Host "  RC에만 있는 커밋 수(RC-only)    : $rcOnlyCount"

# 4) PR 가능 여부 판정
Write-Host "`n[4] PR 가능 여부 판정"
if ($rcOnlyCount -eq 0) {
  Write-Host "  결론: RC 브랜치에 main보다 '새 커밋'이 0개다. GitHub에서 'There isn't anything to compare' 뜨는 게 정상이다."
  if ($mainOnlyCount -gt 0) {
    Write-Host "  추가: RC는 main보다 뒤쳐져 있다(과거 상태)."
  } else {
    Write-Host "  추가: RC와 main이 사실상 동일한 상태다."
  }
} else {
  Write-Host "  결론: RC 브랜치에만 있는 커밋이 존재한다. PR 생성 가능 상태다."
}

# 5) 차이 커밋 목록 출력(최대 30개)
Write-Host "`n[5] RC-only 커밋 목록 (PR로 올라갈 수 있는 것) : origin/main..origin/RC"
git log --oneline --decorate --max-count=30 origin/main..origin/chore/release-candidate-v1

Write-Host "`n[6] main-only 커밋 목록 (RC에 아직 없는 것) : origin/RC..origin/main"
git log --oneline --decorate --max-count=30 origin/chore/release-candidate-v1..origin/main

# 6) CI 비활성화 커밋 탐지(해시를 외우지 말고 메시지로 탐색)
Write-Host "`n[7] 'CI 비활성화' 커밋 탐지"
$disableCommit = (git log origin/main --grep="temporarily disable CI workflows" -n 1 --pretty=format:"%H %s") 2>$null
if ([string]::IsNullOrWhiteSpace($disableCommit)) {
  Write-Host "  발견 못함: 'temporarily disable CI workflows' 메시지 커밋이 origin/main에서 안 보인다."
} else {
  Write-Host "  발견: $disableCommit"
  $disableHash = ($disableCommit -split "\s+")[0]
  Write-Host "  영향 파일:"
  git show --name-only --pretty="" $disableHash
  Write-Host "  (참고) 되돌리려면: git revert $disableHash"
}

# 7) 워크플로우 파일 존재 여부 빠른 체크
Write-Host "`n[8] .github/workflows 존재 여부"
if (Test-Path ".github/workflows") {
  Get-ChildItem ".github/workflows" | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
} else {
  Write-Host "  .github/workflows 폴더가 없다. Actions가 기대대로 안 돌 수 있다."
}

Write-Host "`n== 점검 종료 =="
# ===== END =====

