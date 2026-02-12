# MUD 게임 독립 실행형 패키지

이 패키지는 게임 서버를 Docker로 실행할 수 있도록 구성되어 있습니다.

## 📋 필요 사항

- **Docker Desktop** (Windows/Mac/Linux)
  - 다운로드: https://www.docker.com/products/docker-desktop
  - 설치 후 Docker Desktop을 실행해야 합니다

## 🚀 빠른 시작

### 1. Docker Desktop 실행
Docker Desktop을 설치하고 실행하세요.

### 2. 서버 시작
`start-server.bat` (Windows) 또는 `start-server.sh` (Mac/Linux)를 더블클릭하거나 실행하세요.

```bash
# Windows
start-server.bat

# Mac/Linux
chmod +x start-server.sh
./start-server.sh
```

### 3. 서버 상태 확인
서버가 정상적으로 시작되면 다음 메시지가 표시됩니다:
```
🚀 서버 시작: http://localhost:3000
🎮 WebSocket: ws://localhost:3000
```

### 4. 클라이언트 실행
`../dist/mud_client/mud_client.exe`를 실행하세요.
- 서버 URL: `http://localhost:3000` (기본값)

## 🛠️ 관리 명령어

### 서버 중지
```bash
stop-server.bat  # Windows
# 또는
docker-compose down
```

### 서버 재시작
```bash
restart-server.bat  # Windows
```

### 로그 확인
```bash
docker-compose logs -f server
```

### 데이터베이스 초기화 (주의: 모든 데이터 삭제)
```bash
docker-compose down -v
docker-compose up -d
```

## 📁 구조

```
standalone/
├── docker-compose.yml      # Docker Compose 설정
├── init-db.sh              # 데이터베이스 초기화 스크립트
├── start-server.bat        # Windows 시작 스크립트
├── stop-server.bat         # Windows 중지 스크립트
├── restart-server.bat      # Windows 재시작 스크립트
└── README.md              # 이 파일
```

## 🔧 설정 변경

### 포트 변경
`docker-compose.yml` 파일에서 포트를 변경할 수 있습니다:
- 서버 포트: `3000:3000` (첫 번째 숫자 변경)
- PostgreSQL 포트: `15432:5432`
- Redis 포트: `16379:6379`

### 데이터베이스 비밀번호 변경
`docker-compose.yml` 파일에서 다음 값들을 변경하세요:
```yaml
POSTGRES_PASSWORD: your-password
DATABASE_URL: postgresql://mud:your-password@postgres:5432/mud
```

## 🐛 문제 해결

### Docker가 실행되지 않음
- Docker Desktop이 실행 중인지 확인
- Docker Desktop을 재시작

### 포트가 이미 사용 중
- 다른 프로그램이 포트 3000, 15432, 16379를 사용 중일 수 있습니다
- `docker-compose.yml`에서 포트를 변경하세요

### 서버가 시작되지 않음
```bash
# 로그 확인
docker-compose logs server

# 컨테이너 상태 확인
docker-compose ps

# 컨테이너 재시작
docker-compose restart server
```

### 데이터베이스 연결 오류
```bash
# 데이터베이스 컨테이너 확인
docker-compose ps postgres

# 데이터베이스 로그 확인
docker-compose logs postgres
```

## 📦 배포

이 폴더 전체를 배포하면 됩니다:
1. `standalone/` 폴더 복사
2. Docker Desktop 설치 안내
3. `start-server.bat` 실행 안내

## 🔒 보안 참고사항

**프로덕션 환경에서는 반드시 다음을 변경하세요:**
- `JWT_SECRET`: 강력한 비밀키로 변경
- `POSTGRES_PASSWORD`: 강력한 비밀번호로 변경
- 포트 노출 제한 (방화벽 설정)

## 📝 라이선스

이 패키지는 게임 서버 실행을 위한 독립 실행형 패키지입니다.
