# 독립 실행형 패키지 (Docker 불필요)

이 패키지는 Docker 없이 바로 실행할 수 있는 독립 실행형 패키지입니다.

## 📋 필요 사항

- **Node.js 20.x 이상** (서버 실행용)
  - 다운로드: https://nodejs.org/
  - 설치 후 재시작 필요

## 🚀 빠른 시작

1. `start-game.bat` 더블클릭
2. 게임 시작!

## 📁 구조

```
mud-game-standalone-no-docker/
├── start-game.bat      # 게임 시작 (이것을 실행하세요!)
├── server/             # 게임 서버
│   ├── server.exe      # 서버 실행 파일 (또는 node server.js)
│   └── ...
├── client/             # 게임 클라이언트
│   └── mud_client.exe  # 게임 클라이언트
└── data/               # 게임 데이터
    └── game.db         # SQLite 데이터베이스
```

## 🔧 설정

### 데이터베이스
- SQLite 사용 (별도 설치 불필요)
- 데이터는 `data/game.db`에 저장

### Redis
- 선택사항 (없어도 작동)
- Redis가 없으면 메모리 기반 캐싱 사용

## 🛠️ 문제 해결

### Node.js가 설치되지 않음
- https://nodejs.org/ 에서 다운로드 및 설치
- 설치 후 컴퓨터 재시작

### 포트 충돌
- 포트 3000이 사용 중이면 다른 포트 사용
- `server/.env` 파일에서 `PORT=3001` 등으로 변경

### 데이터베이스 오류
- `data/` 폴더를 삭제하고 다시 시작
- 서버가 자동으로 데이터베이스를 재생성합니다

## 📝 참고

- 서버는 백그라운드에서 실행됩니다
- 서버를 중지하려면 작업 관리자에서 Node.js 프로세스를 종료하세요
- 모든 게임 데이터는 `data/` 폴더에 저장됩니다
