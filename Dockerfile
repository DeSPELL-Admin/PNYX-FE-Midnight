# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Build Stage: 의존성 설치 + Next.js 프로덕션 빌드 생성
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

# pnpm 바이너리 경로를 고정해 모든 스테이지에서 동일한 실행 컨텍스트를 유지합니다.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# corepack으로 pnpm을 활성화해 별도 설치 없이 일관된 패키지 매니저를 사용합니다.
RUN corepack enable

# 작업 디렉터리를 통일해 이후 COPY/RUN 경로 해석을 단순화합니다.
WORKDIR /app

# 의존성 해상도에 필요한 최소 파일만 먼저 복사해 캐시 효율을 확보합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# lockfile과 정확히 일치하도록 고정 설치해 재현 가능한 빌드를 보장합니다.
# NOTE: pnpm store 를 BuildKit 캐시로 마운트하지 않는다 — 캐시 마운트는 별도
#  파일시스템이라 store→node_modules 하드링크가 불가능해 전 파일 copy 로
#  폴백되며 설치가 ~68s → ~6m 으로 느려졌다(실측). 의존성 미변경 빌드의 install
#  은 Docker 레이어 캐시가 통째로 스킵하므로 평문 설치로 충분하다.
RUN pnpm install --frozen-lockfile

# 전체 소스를 복사해 실제 애플리케이션 빌드를 수행합니다.
COPY . .

# 정적 자산/서버 번들을 포함한 프로덕션 산출물을 생성합니다.
# Next 증분 빌드 캐시(.next/cache)를 BuildKit 캐시로 마운트해 콜드 컴파일을
# 피하고 재빌드를 가속한다. (standalone/static 산출물은 캐시 대상이 아님)
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache pnpm build


# ─────────────────────────────────────────────────────────────────────────────
# Runtime Stage: standalone 산출물만 포함해 운영 이미지 구성
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

# 작업 디렉터리를 통일해 이후 COPY/RUN 경로 해석을 단순화합니다.
WORKDIR /app

# 운영 기본값을 명시해 컨테이너 실행 시 동작을 고정합니다.
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# prerender 캐시 디렉터리를 미리 생성해 권한 이슈를 방지합니다.
RUN mkdir -p .next && chown node:node .next

# 런타임에 필요한 최소 파일만 복사해 이미지 크기와 공격 표면을 줄입니다.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# 보안 기본값으로 root 대신 node 사용자를 강제합니다.
USER node

# 애플리케이션 노출 포트를 문서화합니다.
EXPOSE 3000

# standalone 서버를 직접 실행해 의존성을 최소화합니다.
CMD ["node", "server.js"]
