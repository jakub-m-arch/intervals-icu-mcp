# syntax=docker/dockerfile:1
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsdown.config.ts ./
COPY src ./src
RUN npm run build

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-slim
LABEL org.opencontainers.image.source="https://github.com/jakub-m-arch/intervals-icu-mcp" \
      org.opencontainers.image.description="MCP server for Intervals.icu" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
# stdio transport: run with `docker run -i --rm -e INTERVALS_ICU_API_KEY=... <image>`.
ENTRYPOINT ["node", "dist/index.mjs"]
