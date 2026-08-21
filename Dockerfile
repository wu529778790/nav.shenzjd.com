FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

# Turso 环境变量在运行时注入（见 docker-compose.yml），构建期无需提供
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

RUN addgroup --system nodejs && \
    adduser --system --no-create-home --shell /bin/false nextjs

# Copy standalone output (includes server.js and minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets separately (not included in standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ 已无文件（git 不跟踪空目录），sync-standalone-assets.mjs 构建期已把 public
# 合并进 standalone（存在才拷贝），此处无需再 COPY —— 目录缺失时 COPY 会直接构建失败

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

USER nextjs
# Must use shell form to override Docker's automatic HOSTNAME (container ID)
# Otherwise standalone server.js listens on wrong address → 502
CMD HOSTNAME=0.0.0.0 node server.js
