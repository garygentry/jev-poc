FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json vite.config.ts components.json ./
COPY public ./public
COPY src ./src
COPY shared ./shared
COPY server ./server
COPY scripts ./scripts
COPY fixtures ./fixtures

RUN pnpm build

FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS runtime

ARG VCS_REF=unknown
ARG VERSION=dev

LABEL org.opencontainers.image.source="https://github.com/garygentry/jev-poc" \
      org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.version="$VERSION"

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app
# Root-owned: the runtime user can read the app but never rewrite it.
COPY --from=build /app/dist ./dist

USER 1000:1000
EXPOSE 8080

CMD ["node", "dist/server/index.js"]
