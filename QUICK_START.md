# 빠른 시작 가이드 (TEST_MODE 문제 해결)

## 문제
서버가 `TEST_MODE=false`로 실행되어 smoke 테스트가 실패합니다.

## 해결 방법 (3가지)

### 방법 1: PowerShell 스크립트 사용 (권장) ⭐

#### 서버 시작
```powershell
cd "C:\Users\Kyung\Mud Game"
.\start-server-test.ps1
```

#### Smoke 테스트 실행
```powershell
# 새 터미널 창에서
cd "C:\Users\Kyung\Mud Game"
.\run-smoke-test.ps1
```

---

### 방법 2: 수동 실행 (가장 확실)

#### 1단계: 서버 시작 (새 PowerShell 창)
```powershell
cd "C:\Users\Kyung\Mud Game"
$env:TEST_MODE="true"
pnpm --filter server dev
```

**중요**: 
- 반드시 **새 PowerShell 창**에서 실행
- `$env:TEST_MODE="true"`를 **먼저** 설정
- 서버가 완전히 시작될 때까지 대기 (로그에 "서버 시작" 메시지 확인)

#### 2단계: Health 확인 (새 터미널)
```powershell
node -e "fetch('http://localhost:3000/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

**예상 응답**:
```json
{
  "status": "ok",
  "timestamp": 1765926144821,
  "testMode": true  ← 반드시 true여야 함!
}
```

#### 3단계: Smoke 테스트 실행
```powershell
cd "C:\Users\Kyung\Mud Game"
$env:TEST_MODE="true"
pnpm smoke
```

---

### 방법 3: package.json 스크립트 사용

#### 서버 시작
```powershell
cd "C:\Users\Kyung\Mud Game"
pnpm --filter server dev:test
```

**주의**: 이 방법은 Windows에서 환경 변수 전달이 불안정할 수 있습니다.

---

## 문제 진단

### Health 엔드포인트 확인
```powershell
node -e "fetch('http://localhost:3000/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

### 예상 결과
- ✅ `"testMode": true` → 정상! Smoke 테스트 실행 가능
- ❌ `"testMode": false` → 서버를 재시작해야 함

---

## 자주 발생하는 문제

### 문제 1: "서버가 이미 실행 중입니다"
**해결**: 포트 3000을 사용하는 프로세스 종료
```powershell
# 포트 3000 사용 프로세스 찾기
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess

# 프로세스 종료 (PID를 위에서 확인한 값으로 변경)
Stop-Process -Id <PID> -Force
```

### 문제 2: "TEST_MODE가 활성화되지 않았습니다"
**원인**: 서버가 `TEST_MODE=false`로 실행 중
**해결**: 
1. 서버 종료 (Ctrl+C)
2. 새 터미널에서 `$env:TEST_MODE="true"` 설정
3. 서버 재시작

### 문제 3: 환경 변수가 전달되지 않음
**원인**: PowerShell에서 환경 변수 설정이 새 프로세스에 전달되지 않음
**해결**: 
- 방법 1 (스크립트) 사용
- 또는 방법 2 (수동)에서 **새 터미널** 사용

---

## 최종 체크리스트

- [ ] 서버가 `TEST_MODE=true`로 실행 중 (`/health` 확인)
- [ ] Health 응답에 `"testMode": true` 포함
- [ ] Smoke 테스트 실행 전 서버가 완전히 시작됨
- [ ] 새 터미널에서 smoke 실행 (환경 변수 전달)

---

## 성공 확인

Smoke 테스트가 성공하면:
```
✅ 모든 테스트 통과!
   성공: 14, 실패: 0
```

실패하면:
- Health 엔드포인트에서 `testMode` 확인
- 서버 로그에서 `TEST_MODE` 환경 변수 확인
- 위의 문제 진단 섹션 참조

