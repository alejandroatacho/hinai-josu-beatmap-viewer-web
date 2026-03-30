# Build stage
FROM oven/bun:latest AS builder
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile
COPY . .
# Hinamizawa overrides — default false (upstream-safe). Pass --build-arg to enable.
ARG VITE_CUSTOM_DEFAULT_SKIN=false
ARG VITE_HINAI_ENVIRONMENT=false
ENV VITE_CUSTOM_DEFAULT_SKIN=$VITE_CUSTOM_DEFAULT_SKIN
ENV VITE_HINAI_ENVIRONMENT=$VITE_HINAI_ENVIRONMENT
RUN bun run build

# Runtime stage
FROM oven/bun:latest
WORKDIR /app
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
EXPOSE 8080

CMD ["bun", "src/server/index.tsx"]
