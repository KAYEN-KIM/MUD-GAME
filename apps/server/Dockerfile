# Stage 1: Dependencies
FROM node:20-alpine AS deps

# corepack 활성화 (pnpm 사용)
RUN corepack enable

WORKDIR /app

# workspace 전체 package.json 복사 (monorepo 구조)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/

# 의존성 설치
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder

RUN corepack enable

WORKDIR /app

# deps stage에서 node_modules 복사
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# 소스 코드 복사
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server ./apps/server

# Prisma generate (런타임 클라이언트 생성)
WORKDIR /app/apps/server
RUN npx prisma generate

# NestJS 빌드
WORKDIR /app
RUN pnpm --filter server build

# Stage 3: Runner
FROM node:20-alpine AS runner

# 프로덕션 패키지만 설치하기 위한 준비
RUN corepack enable

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile --prod

# 빌드 결과물 복사
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/node_modules/.prisma ./apps/server/node_modules/.prisma

# content 파일 복사 (JSON 데이터)
COPY apps/server/content ./apps/server/content
COPY apps/server/src/content ./apps/server/src/content

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=3000

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 서버 실행
CMD ["node", "apps/server/dist/main.js"]

