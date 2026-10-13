FROM oven/bun:1.3.14 AS dependencies
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/icons/package.json packages/icons/package.json
COPY patches ./patches
RUN bun install --frozen-lockfile --production --filter @atria/api --filter @atria/core --ignore-scripts

FROM dependencies AS build
COPY apps/api ./apps/api
COPY packages/core ./packages/core
RUN bun run --cwd apps/api build && test -s apps/api/dist/index.js

FROM oven/bun:1.3.14 AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/core ./packages/core
USER bun
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["bun", "dist/index.js"]
