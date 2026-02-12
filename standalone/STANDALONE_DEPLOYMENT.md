# 독립 실행형 패키지 배포 가이드

## 📦 패키지 구성

독립 실행형 패키지는 다음을 포함합니다:
- **서버**: Docker Compose로 실행되는 게임 서버
- **클라이언트**: Windows 실행 파일
- **데이터베이스**: PostgreSQL (Docker 컨테이너)
- **캐시**: Redis (Docker 컨테이너)

## 🚀 배포 방법

### 1. 패키지 생성

```powershell
# 프로젝트 루트에서 실행
.\standalone\package-standalone.ps1
```

생성된 패키지 위치: `dist\mud-game-standalone\`

### 2. 패키지 압축

```powershell
Compress-Archive -Path "dist\mud-game-standalone\*" -DestinationPath "dist\mud-game-standalone.zip"
```

### 3. 사용자 배포

사용자에게 다음을 제공:
1. `mud-game-standalone.zip` 파일
2. Docker Desktop 설치 안내

## 📋 사용자 설치 가이드

### 필수 사항
- **Windows 10/11**
- **Docker Desktop** (https://www.docker.com/products/docker-desktop)

### 설치 단계

1. **Docker Desktop 설치**
   - https://www.docker.com/products/docker-desktop 에서 다운로드
   - 설치 후 Docker Desktop 실행

2. **패키지 압축 해제**
   - `mud-game-standalone.zip` 압축 해제
   - 원하는 위치에 폴더 생성 (예: `C:\Games\MudGame`)

3. **게임 실행**
   - `start-game.bat` 더블클릭
   - 자동으로 서버가 시작되고 클라이언트가 실행됩니다

4. **게임 종료**
   - 클라이언트 창 닫기
   - `server\stop-server.bat` 실행

## 🔧 고급 설정

### 포트 변경
`server\docker-compose.yml` 파일에서 포트를 변경할 수 있습니다:
- 서버: `3000:3000` → `원하는포트:3000`
- PostgreSQL: `15432:5432`
- Redis: `16379:6379`

### 데이터베이스 초기화
모든 게임 데이터를 삭제하고 처음부터 시작:
```bash
cd server
docker-compose down -v
docker-compose up -d
```

### 서버만 실행 (클라이언트 없이)
```bash
cd server
start-server.bat
```

## 🐛 문제 해결

### Docker Desktop이 실행되지 않음
- Docker Desktop을 설치하고 실행해야 합니다
- 시스템 재시작 후 다시 시도

### 포트 충돌
- 다른 프로그램이 포트를 사용 중일 수 있습니다
- `docker-compose.yml`에서 포트를 변경하세요

### 서버가 시작되지 않음
```bash
cd server
docker-compose logs server
```

### 데이터베이스 오류
```bash
cd server
docker-compose restart postgres
docker-compose logs postgres
```

## 📊 시스템 요구사항

- **CPU**: 2코어 이상 권장
- **RAM**: 4GB 이상 권장
- **디스크**: 2GB 이상 여유 공간
- **네트워크**: 인터넷 연결 (Docker 이미지 다운로드용, 최초 1회)

## 🔒 보안 참고사항

**프로덕션 배포 시:**
- `docker-compose.yml`의 `JWT_SECRET` 변경
- `POSTGRES_PASSWORD` 변경
- 방화벽 설정 (포트 노출 제한)

## 📝 라이선스

이 패키지는 독립 실행형 게임 서버입니다.
