# 실행 가이드 (Web / Android / iOS)

이 문서는 “서버 + DB/Redis + Flutter 클라이언트”를 **항상 같은 방법으로** 실행하기 위한 가이드입니다.

## 공통 포트

- **서버 (NestJS)**: `http://localhost:3000`
- **PostgreSQL (Docker)**: `localhost:15432` (컨테이너 내부는 5432)
- **Redis (Docker)**: `localhost:16379` (컨테이너 내부는 6379)
- **Flutter Web**: `http://localhost:8080`

## 1) 인프라(Postgres/Redis) 실행

```bash
cd infra
docker-compose up -d
```

## 2) 서버 준비 (마이그레이션/시드)

```bash
cd apps/server

# 마이그레이션 적용
npx prisma migrate deploy

# 시드(룸/출구/몬스터/아이템/퀘스트 생성)
npx prisma db seed
```

## 3) 서버 실행

```bash
cd C:\Users\Kyung\Mud Game
pnpm --filter server dev
```

### 전투 Tick Worker (선택)

현재 개발 환경에서는 테이블 미존재로 인한 로그 스팸을 피하려고 기본 OFF 입니다.

```powershell
$env:COMBAT_TICK_ENABLED="true"
pnpm --filter server dev
```

## 4) Flutter 클라이언트 실행

### Web (권장 디버깅)

```bash
cd mud_client
flutter run -d chrome --web-port=8080
```

### Android 에뮬레이터

- REST: `http://10.0.2.2:3000`
- WS: `ws://10.0.2.2:3000`

```bash
cd mud_client
flutter run
```

### Android 실기기 / iOS 실기기

- PC의 IP로 접속해야 합니다. 예: `http://192.168.0.15:3000`
- **PC/기기가 같은 Wi‑Fi**에 있어야 합니다.

## 5) 접속 후 “머드처럼” 테스트

홈 화면에서:

- `look` 또는 `l` : 현재 방 묘사 출력
- `n/s/e/w/u/d` : 이동
- `say 안녕` : 로컬 채팅(같은 방에 브로드캐스트)
- `help` : 도움말

## 문제 해결

- Web에서 “서버 연결 실패”
  - 서버가 `3000`에서 실행 중인지 확인
  - 브라우저 콘솔에 `[WS] Raw message 수신:` 로그가 나오는지 확인
- DB 연결 오류(P1001)
  - `docker-compose ps`로 postgres가 healthy인지 확인
  - `infra/docker-compose.yml`의 포트가 `15432`로 되어 있는지 확인


