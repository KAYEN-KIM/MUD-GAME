# 완전 독립 실행형 패키지 (추가 설치 불필요)

이 패키지는 **다른 PC에서 추가 설치 없이 바로 실행**할 수 있습니다.

## ✅ 포함된 것

- ✅ 게임 서버 (실행 파일로 패키징)
- ✅ 게임 클라이언트 (Windows 실행 파일)
- ✅ SQLite 데이터베이스 (자동 생성)
- ✅ 모든 필요한 파일

## ❌ 필요 없는 것

- ❌ Node.js 설치 불필요
- ❌ Docker 설치 불필요
- ❌ PostgreSQL 설치 불필요
- ❌ Redis 설치 불필요
- ❌ 추가 소프트웨어 설치 불필요

## 🚀 사용 방법

### 1. 패키지 빌드 (개발자용)

```powershell
# 프로젝트 루트에서 실행
.\standalone-no-docker\build-standalone-server.ps1
```

이 스크립트는:
1. 서버를 빌드합니다
2. pkg로 서버를 실행 파일(`server.exe`)로 패키징합니다
3. 시작 스크립트를 업데이트합니다

### 2. 배포

```powershell
# 패키지 압축
Compress-Archive -Path "dist\mud-game-standalone-no-docker\*" -DestinationPath "mud-game-standalone.zip"
```

### 3. 다른 PC에서 실행

1. `mud-game-standalone.zip` 압축 해제
2. `start-game.bat` 더블클릭
3. 게임 시작!

**추가 설치 불필요합니다!**

## 📁 패키지 구조

```
mud-game-standalone-no-docker/
├── start-game.bat      # 게임 시작 (이것을 실행!)
├── server/
│   ├── server.exe      # 서버 실행 파일 (Node.js 포함)
│   ├── prisma/         # 데이터베이스 스키마
│   └── ...
├── client/
│   └── mud_client.exe  # 게임 클라이언트
└── data/               # 게임 데이터 (자동 생성)
    └── game.db         # SQLite 데이터베이스
```

## 🔧 문제 해결

### 서버가 시작되지 않음
- Windows Defender나 백신 프로그램이 실행 파일을 차단할 수 있습니다
- 예외 추가 또는 실행 허용

### 포트 충돌
- 포트 3000이 사용 중이면 서버가 시작되지 않습니다
- 다른 프로그램을 종료하거나 서버 포트 변경

### 데이터베이스 오류
- `data/` 폴더를 삭제하고 다시 시작
- 서버가 자동으로 데이터베이스를 재생성합니다

## 📝 참고

- 서버는 백그라운드에서 실행됩니다
- 서버를 중지하려면 작업 관리자에서 `server.exe` 프로세스를 종료하세요
- 모든 게임 데이터는 `data/game.db`에 저장됩니다
- 이 파일을 백업하면 게임 데이터를 보존할 수 있습니다

## 🎮 완전 독립 실행형!

이 패키지는 **완전히 독립적**입니다:
- 인터넷 연결 불필요 (로컬 게임)
- 추가 소프트웨어 설치 불필요
- 설정 불필요
- 바로 실행 가능!
