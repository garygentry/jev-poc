FROM node:22-bookworm-slim AS build

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

FROM node:22-bookworm-slim AS runtime

ARG VCS_REF=unknown
ARG VERSION=dev

LABEL org.opencontainers.image.source="https://github.com/garygentry/jev-poc" \
      org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.version="$VERSION"

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist

USER 1000:1000
EXPOSE 8080

CMD ["node", "dist/server/index.js"]
