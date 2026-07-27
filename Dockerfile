# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci is intentionally not used here: @sentry/nextjs pins a vite peer range
# (^3-^6) that conflicts with vitest@4's vite@8, which `install` tolerates but
# `ci` rejects. See package-lock.json / npm ls vite for the underlying conflict.
RUN npm install

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Build-time-only dummy values so `next build` (which touches DATABASE_URL/
# BETTER_AUTH_SECRET at import time) succeeds without real secrets. Real
# values are supplied to the container at runtime.
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ARG BETTER_AUTH_SECRET="build-time-placeholder-secret"
ARG BETTER_AUTH_URL="http://localhost:3000"
ENV DATABASE_URL=${DATABASE_URL} \
    BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET} \
    BETTER_AUTH_URL=${BETTER_AUTH_URL}

RUN npx prisma generate
RUN npm run build

# ---- Runtime ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Next.js standalone output: minimal server + traced node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema + migrations for `prisma migrate deploy` at deploy time
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
