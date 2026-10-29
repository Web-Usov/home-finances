# Build context is the REPOSITORY ROOT (see docker-compose.yml):
#   docker build -f apps/api/Dockerfile .
# The API depends on workspace packages (@family-budget/types), so it cannot be built
# from apps/api alone.

# ---- builder: full dependencies, compiled output, generated Prisma client ----
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Manifests of every workspace project (the lockfile covers all of them) ...
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY e2e/package.json ./e2e/package.json
# ... but install only what the API needs. Scripts are off: the root `prepare`
# (lefthook) is irrelevant here; Prisma is generated explicitly below.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@family-budget/api..."

COPY apps/api ./apps/api
RUN pnpm --filter @family-budget/api exec prisma generate \
 && pnpm --filter @family-budget/types build \
 && pnpm --filter @family-budget/api build

# ---- production: prod dependencies + compiled output only ----
FROM node:20-alpine AS production

RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY e2e/package.json ./e2e/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --prod --filter "@family-budget/api..."

# `prisma` is a production dependency: it generates the client for this platform here
# and the `migrate` compose service reuses this image to run `prisma migrate deploy`.
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm --filter @family-budget/api exec prisma generate

# Compiled code.
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main"]
