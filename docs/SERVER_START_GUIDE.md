# 서버 시작 가이드

## 문제 해결

### PostgreSQL 포트 충돌
PostgreSQL이 이미 실행 중이거나 포트가 사용 중일 수 있습니다.

**해결 방법:**
1. 기존 PostgreSQL 서비스 확인:
   ```powershell
   Get-Service | Where-Object {$_.Name -like "*postgres*"}
   ```

2. Docker 컨테이너 확인:
   ```powershell
   docker ps -a | findstr postgres
   ```

3. 포트 사용 확인:
   ```powershell
   netstat -ano | findstr ":5432"
   ```

### 서버 수동 시작

1. **인프라 시작** (PostgreSQL, Redis):
   ```powershell
   pnpm infra:up
   ```

2. **DB 대기**:
   ```powershell
   pnpm db:wait
   ```

3. **마이그레이션** (필요시):
   ```powershell
   cd apps/server
   npx prisma migrate deploy
   ```

4. **서버 시작**:
   ```powershell
   cd "C:\Users\Kyung\Mud Game"
   pnpm dev
   ```

5. **서버 확인**:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/health"
   ```

## 네트워크 감지 개선 사항

### 변경 내용
- 우선순위 IP를 먼저 시도 (192.168.0.15, 192.168.0.10)
- 타임아웃을 2초로 단축하여 빠른 감지
- 상세한 로그 출력으로 디버깅 용이

### PC IP 확인
```powershell
ipconfig | findstr /i "IPv4"
```

현재 PC IP:
- 192.168.0.15 (Wi-Fi 2)
- 192.168.0.10 (Wi-Fi)

이 IP들이 NetworkDetector의 최우선순위로 설정되어 있습니다.

## 앱 빌드

```powershell
cd mud_client
flutter clean
flutter pub get
flutter run -d R3CT80BZMPN
```

## 테스트

1. 앱 실행 후 설정 화면에서 서버 주소 확인
2. 자동 감지가 실패하면 수동으로 입력:
   - REST: `http://192.168.0.15:3000`
   - WS: `ws://192.168.0.15:3000`
3. 연결 테스트


