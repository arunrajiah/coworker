FROM node:22-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/config/package.json packages/config/
COPY packages/adapters/storage-local/package.json packages/adapters/storage-local/
COPY packages/adapters/email-nodemailer/package.json packages/adapters/email-nodemailer/
COPY packages/adapters/billing-noop/package.json packages/adapters/billing-noop/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
# Copy all of /app from deps (includes root + per-app node_modules with binaries)
COPY --from=deps /app ./
# Overlay with actual source files
COPY . .
RUN pnpm --filter=@coworker/worker build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

RUN mkdir -p /uploads
CMD ["node", "dist/index.js"]
