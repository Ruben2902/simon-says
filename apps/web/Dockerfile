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

COPY apps/web apps/web
COPY packages packages
ARG NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:3001
ENV NEXT_PUBLIC_GAME_SERVER_URL=$NEXT_PUBLIC_GAME_SERVER_URL
RUN pnpm --filter @simon/web build

FROM node:22-alpine AS runner

ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3000
WORKDIR /app/apps/web

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./standalone
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./standalone/apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "standalone/apps/web/server.js"]
