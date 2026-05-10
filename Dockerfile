FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server-copilot/package.json ./packages/server-copilot/
COPY packages/server-antigravity/package.json ./packages/server-antigravity/
COPY packages/server-cursor/package.json ./packages/server-cursor/
COPY packages/gateway/package.json ./packages/gateway/

RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/server-copilot/ ./packages/server-copilot/
COPY packages/server-antigravity/ ./packages/server-antigravity/
COPY packages/server-cursor/ ./packages/server-cursor/
COPY packages/gateway/ ./packages/gateway/

RUN npm run build

# ──────────────────────────────────────────────

FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server-copilot/package.json ./packages/server-copilot/
COPY packages/server-antigravity/package.json ./packages/server-antigravity/
COPY packages/server-cursor/package.json ./packages/server-cursor/
COPY packages/gateway/package.json ./packages/gateway/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server-copilot/dist ./packages/server-copilot/dist
COPY --from=builder /app/packages/server-antigravity/dist ./packages/server-antigravity/dist
COPY --from=builder /app/packages/server-cursor/dist ./packages/server-cursor/dist
COPY --from=builder /app/packages/gateway/dist ./packages/gateway/dist

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "packages/gateway/dist/index.js"]
