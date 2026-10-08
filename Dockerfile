FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .

RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" pnpm db:generate && DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1

CMD ["sh", "-c", "pnpm db:deploy && pnpm start"]
