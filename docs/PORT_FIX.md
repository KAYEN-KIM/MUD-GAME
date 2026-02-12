# PostgreSQL 포트 충돌 해결

## 문제
Windows에서 PostgreSQL 포트 5432가 예약되어 있어 Docker 컨테이너가 시작되지 않았습니다.

## 해결 방법
PostgreSQL 포트를 **15432**로 변경했습니다.

### 변경 사항
1. `infra/docker-compose.yml`: 포트 매핑을 `15432:5432`로 변경
2. `run-dev-android.ps1`: DATABASE_URL 환경 변수를 자동 설정

### DATABASE_URL
```
postgresql://mud:mudpass@localhost:15432/mud
```

### .env 파일 업데이트 필요
`apps/server/.env` 파일에 다음을 추가하거나 수정:
```
DATABASE_URL=postgresql://mud:mudpass@localhost:15432/mud
```

## 확인
```powershell
docker ps | findstr mud-postgres
```

포트가 `0.0.0.0:15432->5432/tcp`로 표시되어야 합니다.


