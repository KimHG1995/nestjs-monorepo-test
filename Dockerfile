# syntax=docker/dockerfile:1
# 하나의 Dockerfile 로 모든 앱을 빌드합니다. 빌드 시 --build-arg APP=<app> 로 대상 지정.
#   docker build --build-arg APP=web-server -t web-server .
ARG NODE_VERSION=24

# ---- 1) 빌드 스테이지 ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# Docker 빌드 컨텍스트에는 .git 이 없으므로 husky(prepare 훅) 설치를 건너뜁니다.
ENV HUSKY=0

# 의존성 설치 (postinstall 의 prisma generate 를 위해 설정과 스키마를 먼저 복사)
COPY package*.json ./
COPY prisma.config.ts ./
COPY libs/prisma-client/prisma ./libs/prisma-client/prisma
RUN npm ci

# 소스 복사 후 대상 앱 빌드
COPY . .
ARG APP
RUN test -n "$APP" && npx nest build "$APP"

# ---- 2) 런타임 스테이지 ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 프로덕션 의존성만 설치 (postinstall 스킵 → 생성된 Prisma Client 는 builder 에서 복사)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

# 헬스체크/실행 대상 앱 이름을 런타임 환경변수로 전달
ARG APP
ENV APP=${APP}

# entryFile 은 main 이므로 dist/apps/<APP>/main.js 를 실행합니다.
CMD ["sh", "-c", "node dist/apps/${APP}/main"]
