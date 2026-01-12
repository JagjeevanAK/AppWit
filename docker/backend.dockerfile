FROM oven/bun:1.3.2

WORKDIR /app

COPY package.json bun.lock turbo.json ./

COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/agent/package.json ./packages/agent/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/sandbox/package.json ./packages/sandbox/package.json
COPY packages/storage/package.json ./packages/storage/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN bun install

COPY packages/typescript-config ./packages/typescript-config

COPY packages/agent ./packages/agent
COPY packages/db ./packages/db
COPY packages/sandbox ./packages/sandbox
COPY packages/storage ./packages/storage

COPY apps/backend ./apps/backend

RUN cd packages/db && bunx prisma generate

CMD ["sh", "-c", "cd packages/db && bunx prisma migrate deploy && cd /app/apps/backend && bun run index.ts"]
