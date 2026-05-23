# ============================================================
#  PMS — ProjectHub Docker Image (Release Build)
#  모노레포 구조: apps/web (프런트엔드), backend (Rust Axum)
# ============================================================

# ── Stage 1: 프런트엔드 빌드 ────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /build

# 루트 워크스페이스 매니페스트 복사
COPY package.json package-lock.json* ./

# packages/* 워크스페이스 매니페스트 복사 (공유 패키지)
COPY packages/ ./packages/

# apps/web 워크스페이스 매니페스트 복사
COPY apps/web/package.json ./apps/web/

# 루트에서 전체 의존성 설치 (워크스페이스 링크 포함)
# BuildKit 캐시 마운트를 사용하여 npm 캐시 활용
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# apps/web 소스 복사 및 빌드
COPY apps/web/ ./apps/web/
RUN npm run build --workspace=apps/web

# ── Stage 2: 백엔드 빌드 ────────────────────────────────────
FROM rust:slim-bookworm AS backend-builder
WORKDIR /build

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        pkg-config libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# 소스 복사
COPY Cargo.toml Cargo.lock* ./
COPY backend/ ./backend/

# 데스크탑 앱 워크스페이스 제외
RUN sed -i '/apps\/desktop\/src-tauri/d' Cargo.toml

# BuildKit 캐시 마운트를 사용하여 Cargo 레지스트리와 target 디렉터리 캐시 활용
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo build --release -p backend && \
    cp target/release/backend /pms

# ── Stage 3: 최종 런타임 이미지 ─────────────────────────────
FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libsqlite3-0 ca-certificates curl tzdata nginx && \
    rm -rf /var/lib/apt/lists/*

# Nginx 설정 및 프런트엔드 정적 파일 복사
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /build/apps/web/dist /usr/share/nginx/html

# 백엔드 바이너리 및 설정 복사
COPY --from=backend-builder /pms ./pms
COPY config.toml .
COPY docker/start.sh .
RUN chmod +x start.sh
RUN mkdir -p data/attachments logs

EXPOSE 80
VOLUME ["/app/data", "/app/logs"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:80/ > /dev/null

CMD ["./start.sh"]
