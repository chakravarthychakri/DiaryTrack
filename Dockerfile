# Multi-stage Production Dockerfile for DairyTrack
# =============================================================
# Stage 1: Build Frontend and TypeScript Backend
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:all

# =============================================================
# Stage 2: Minimal Production Image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime tools for sqlite & healthcheck
RUN apk add --no-cache curl tzdata

# Create dedicated non-root application user
RUN addgroup -g 1001 -S dairytrack && \
    adduser -u 1001 -S dairytrack -G dairytrack

# Copy dependencies and compiled outputs
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/supabase ./supabase

# Create directory for persistent backups & SQLite DB
RUN mkdir -p /app/backups && chown -R dairytrack:dairytrack /app

USER dairytrack
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
