# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

COPY apps/server apps/server
COPY packages packages
RUN pnpm --filter @simon/server build
RUN pnpm --filter @simon/server deploy --prod --legacy /prod/server

FROM node:22-alpine AS runner

ENV HOST=0.0.0.0 \
    NODE_ENV=production \
    PORT=3001
WORKDIR /app

COPY --from=builder --chown=node:node /prod/server/package.json ./package.json
COPY --from=builder --chown=node:node /prod/server/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/server/dist ./dist

USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
