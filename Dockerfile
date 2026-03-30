# Build stage
FROM oven/bun:1.2 AS builder
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
FROM oven/bun:1.2
WORKDIR /app
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/public ./public
RUN chown -R appuser:appgroup /app

ENV NODE_ENV=production
EXPOSE 8080

USER appuser
CMD ["bun", "src/server/index.tsx"]
