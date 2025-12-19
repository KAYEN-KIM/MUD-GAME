# MUD 게임 서버

NestJS 기반 판타지 텍스트 MUD 게임 서버

## 환경 변수

`.env.example` 파일을 복사하여 `.env` 생성:

```bash
cp .env.example .env
```

필수 환경 변수:
- `DATABASE_URL` - PostgreSQL 연결 문자열
- `REDIS_URL` - Redis 연결 문자열
- `JWT_SECRET` - JWT 토큰 비밀키
- `ADMIN_KEY` - 관리자 API 키

## 스크립트

```bash
# 개발 모드
pnpm dev

# 빌드
pnpm build

# 프로덕션 실행
pnpm start

# Prisma
pnpm prisma:generate   # 클라이언트 생성
pnpm prisma:migrate    # 마이그레이션
pnpm prisma:seed       # 시드 (50개 룸 자동 생성)
pnpm prisma:studio     # GUI

# 테스트
pnpm test
```

## WebSocket 이벤트

자세한 내용은 `../../tools/ws-smoke.md` 참조

## Prisma 스키마

주요 모델:
- `User` - 사용자
- `Character` - 캐릭터
- `Room` - 룸 (50개)
- `Monster` - 몬스터
- `Item` - 아이템
- `Party` - 파티
- `Encounter` - 전투
- `ChatMessage` - 채팅
- `Report` - 신고
- `Punishment` - 제재

## 시드 데이터

`prisma/seed.ts`는 다음을 자동 생성합니다:
- 도시 룸 10개 (GH_*)
- 미궁 1층 20개 (R1_00 ~ R1_19)
- 미궁 2층 20개 (R2_00 ~ R2_19)
- 출구 연결
- 몬스터 12종
- 아이템 25종
- 퀘스트 10개
- 드롭 테이블
- 스폰 테이블

생성된 데이터는 `src/content/*.json`에 저장됩니다.

## 아키텍처

```
src/
├── main.ts                 # 진입점
├── app.module.ts           # 루트 모듈
├── common/                 # 공통 유틸리티
│   ├── config/            # 환경 변수 검증
│   ├── guards/            # 인증/권한 가드
│   ├── utils/             # 유틸리티 함수
│   ├── prisma.service.ts
│   └── redis.service.ts
├── rate-limit/            # 레이트 리밋
├── modules/
│   ├── auth/             # 인증
│   ├── ws/               # WebSocket Gateway
│   ├── world/            # 월드 (이동, 사냥)
│   ├── party/            # 파티
│   ├── combat/           # 전투
│   ├── chat/             # 채팅
│   └── admin/            # 관리자
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

## 개발 가이드

### 새 이벤트 추가

1. `modules/ws/dto.ts`에 타입 정의
2. `modules/ws/ws.gateway.ts`에 핸들러 추가
3. 해당 서비스 로직 구현

### 새 엔드포인트 추가

컨트롤러에 메서드 추가 후 서비스 로직 구현

## TODO

- [ ] 전투 턴 해결 로직 구현
- [ ] 스킬 시스템
- [ ] 경험치/레벨업
- [ ] 퀘스트 진행 추적

