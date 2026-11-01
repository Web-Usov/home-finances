# Web client image: Expo web export (EXPO_PUBLIC_API_URL=same-origin) served by scripts/preview/serve-web.mjs,
# which also proxies /api to the `api` compose service. Build context is the REPOSITORY ROOT:
#   docker build -f docker/web/Dockerfile .

# ---- builder: static export ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile ./apps/mobile
COPY e2e/package.json ./e2e/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@family-budget/mobile..."

# Same-origin: the page talks to /api on its own origin, so the image works behind any host/port.
ENV EXPO_PUBLIC_API_URL=same-origin
RUN pnpm --filter @family-budget/types build \
 && cd apps/mobile && pnpm exec expo export --clear --platform web --output-dir /out/web

# ---- runtime: dependency-free node server ----
FROM node:20-alpine AS production

ENV NODE_ENV=production \
    PREVIEW_HOME=/srv/web \
    WEB_PORT=8080 \
    WEB_HOST=0.0.0.0 \
    API_PROXY_TARGET=http://api:3000
# serve-web.mjs resolves the release as $PREVIEW_HOME/current/.preview/web (+ version.json).
WORKDIR /srv/web
COPY --from=builder /out/web ./release/.preview/web
RUN ln -s release current && echo '{"image":"family-budget-web"}' > release/.preview/version.json
COPY scripts/preview/serve-web.mjs /srv/serve-web.mjs

EXPOSE 8080
USER node
CMD ["node", "/srv/serve-web.mjs"]
