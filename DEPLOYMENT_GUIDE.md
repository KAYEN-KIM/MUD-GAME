# 배포 가이드

## 현재 구조

### ❌ 독립 실행형이 아닙니다
현재 배포판(`dist\mud_client`)은 **클라이언트만** 포함되어 있으며, **백엔드 서버가 별도로 필요**합니다.

### 필요한 구성 요소

1. **클라이언트** (Flutter Windows 앱)
   - 위치: `dist\mud_client\`
   - 역할: 사용자 인터페이스 및 서버 통신

2. **서버** (NestJS)
   - 위치: `apps\server\`
   - 역할: 게임 로직, 데이터베이스 관리, WebSocket 통신
   - 포트: 3000 (기본값)

3. **데이터베이스** (PostgreSQL)
   - 역할: 게임 데이터 저장 (캐릭터, 아이템, 퀘스트 등)

4. **Redis** (선택사항, 권장)
   - 역할: 캐싱, Rate Limiting

---

## 배포 옵션

### 옵션 1: 클라이언트 + 서버 분리 배포 (현재 구조)

#### 클라이언트 배포
```
dist\mud_client\ 폴더 전체를 배포
```

#### 서버 배포
서버를 별도로 배포해야 합니다:

**로컬/개인 서버:**
```bash
# 1. 서버 폴더로 이동
cd apps/server

# 2. 의존성 설치
pnpm install

# 3. 환경 변수 설정 (.env 파일 생성)
DATABASE_URL="postgresql://user:password@localhost:5432/mudgame"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
PORT=3000

# 4. 데이터베이스 마이그레이션
pnpm prisma migrate deploy
pnpm prisma generate

# 5. 시드 데이터 생성 (선택사항)
pnpm prisma:seed

# 6. 서버 실행
pnpm start
```

**클라우드 배포 (예: AWS, Heroku, Railway):**
- 서버 코드를 클라우드에 배포
- PostgreSQL 데이터베이스 설정
- Redis 설정 (선택사항)
- 환경 변수 설정
- 클라이언트에서 서버 URL 변경

---

### 옵션 2: 독립 실행형 패키지 만들기 (개선 필요)

현재는 지원되지 않지만, 다음과 같이 개선할 수 있습니다:

#### 방법 A: 서버를 Electron에 통합
- Electron 앱으로 클라이언트 + 서버 통합
- 내장 데이터베이스 (SQLite) 사용
- 단일 실행 파일로 배포 가능

#### 방법 B: 서버를 클라이언트에 내장
- Flutter에서 서버 프로세스 실행
- 내장 데이터베이스 사용
- 복잡하고 성능 이슈 가능

#### 방법 C: Docker 컨테이너 패키징
- Docker로 서버 + DB + Redis 통합
- Docker Desktop 필요
- 상대적으로 간단

---

## 현재 배포 시나리오

### 시나리오 1: 개인 사용
1. **서버 설정** (한 번만)
   ```bash
   # PostgreSQL 설치 및 설정
   # Redis 설치 (선택사항)
   # 서버 실행
   cd apps/server
   pnpm install
   # .env 파일 설정
   pnpm prisma migrate deploy
   pnpm start
   ```

2. **클라이언트 실행**
   - `dist\mud_client\mud_client.exe` 실행
   - 설정에서 서버 URL 확인 (기본: `http://localhost:3000`)

### 시나리오 2: 여러 사용자 (로컬 네트워크)
1. **서버 PC에서:**
   ```bash
   # 서버 실행 (포트 3000)
   cd apps/server
   pnpm start
   ```

2. **서버 IP 확인:**
   ```bash
   ipconfig  # Windows
   # 예: 192.168.1.100
   ```

3. **클라이언트 PC에서:**
   - `mud_client.exe` 실행
   - 설정에서 서버 URL 변경: `http://192.168.1.100:3000`

### 시나리오 3: 인터넷 배포
1. **클라우드 서버 설정:**
   - AWS, Heroku, Railway 등에 서버 배포
   - 도메인 설정 (예: `https://mudgame.example.com`)

2. **클라이언트 배포:**
   - 클라이언트에 서버 URL 하드코딩 또는 설정 파일 포함
   - 사용자는 클라이언트만 다운로드하여 실행

---

## 빠른 시작 (로컬)

### 1. 서버 설정
```bash
# PostgreSQL 설치 (없는 경우)
# https://www.postgresql.org/download/windows/

# 데이터베이스 생성
createdb mudgame

# 서버 폴더로 이동
cd apps/server

# 의존성 설치
pnpm install

# 환경 변수 설정
# .env 파일 생성:
DATABASE_URL="postgresql://postgres:password@localhost:5432/mudgame"
JWT_SECRET="your-secret-key-here"
PORT=3000

# 마이그레이션
pnpm prisma migrate deploy
pnpm prisma generate
pnpm prisma:seed

# 서버 실행
pnpm start
```

### 2. 클라이언트 실행
```bash
# 배포 폴더로 이동
cd dist\mud_client

# 실행
.\mud_client.exe
```

---

## 요약

| 구성 요소 | 독립 실행 | 별도 필요 |
|---------|---------|---------|
| 클라이언트 | ✅ | ❌ |
| 서버 | ❌ | ✅ |
| 데이터베이스 | ❌ | ✅ |
| Redis | ❌ | 선택사항 |

**결론**: 현재는 **백엔드 서버가 별도로 필요**합니다. 클라이언트만으로는 작동하지 않습니다.

독립 실행형을 원하시면 옵션 2의 방법들을 고려해볼 수 있습니다.
