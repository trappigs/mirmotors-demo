# Mir Motors — kendi sunucumuzda (VDS) çalıştırmak için imaj. Kullanım: deploy/VDS_KURULUM.md
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Sunucunun paket deposuna bağlantısı zaman zaman yavaşlıyor: uzun bekleme ve yeniden deneme.
RUN npm ci --fetch-timeout=600000 --fetch-retries=6 --fetch-retry-maxtimeout=120000
COPY . .
# Derleme veritabanına bağlanmaz; Prisma yalnızca bir adres ister.
ENV DATABASE_URL=postgresql://derleme:derleme@localhost:5432/derleme \
    DATABASE_URL_UNPOOLED=postgresql://derleme:derleme@localhost:5432/derleme \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
# Açılışta yalnızca bekleyen migration'lar uygulanır; veri silinmez, seed çalışmaz.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
