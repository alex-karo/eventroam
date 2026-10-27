FROM node:26.11.1-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM dependencies AS source
COPY src ./src
COPY commands ./commands
COPY scripts/build-studio-commands.mjs ./scripts/build-studio-commands.mjs
COPY tsconfig.json next-env.d.ts next.config.ts postcss.config.mjs ./

FROM source AS web-build
COPY public ./public
ARG EVENTROAM_MAPBOX_TOKEN=""
ARG EVENTROAM_MAPBOX_STYLE="mapbox://styles/mapbox/streets-v12"
RUN NEXT_PUBLIC_MAPBOX_TOKEN="$EVENTROAM_MAPBOX_TOKEN" NEXT_PUBLIC_MAPBOX_STYLE="$EVENTROAM_MAPBOX_STYLE" npm run build

FROM source AS studio-build
RUN DATABASE_PATH=/tmp/build/eventroam.sqlite CATALOG_OBSERVABILITY_DATABASE_PATH=/tmp/build/history.duckdb CATALOG_CHAT_DATABASE_PATH=/tmp/build/chat.sqlite npm run studio:build
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
RUN mkdir /data && chown node:node /data
COPY scripts/health.mjs ./health.mjs
USER node

FROM runtime AS web
COPY --from=web-build --chown=node:node /app/.next/standalone ./
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static
COPY --from=web-build --chown=node:node /app/public ./public
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s CMD ["node", "health.mjs", "http://127.0.0.1:3000/health"]
CMD ["node", "server.js"]

FROM runtime AS studio
COPY --from=studio-build --chown=node:node /app/node_modules ./node_modules
COPY --from=studio-build --chown=node:node /app/.mastra/output/commands ./commands
COPY --from=studio-build --chown=node:node /app/.mastra/output/studio ./studio
COPY --from=studio-build --chown=node:node /app/src/db/migrations ./src/db/migrations
EXPOSE 4111
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s CMD ["node", "health.mjs", "http://127.0.0.1:4111/health"]
CMD ["node", "commands/studio-start.mjs"]
