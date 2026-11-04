#!/bin/sh
# Gece yedeği: veritabanı (pg_dump) + yüklenen dosyalar. Son 7 günü tutar.
# Sunucuda cron ile çalışır: /etc/cron.d/mirmotors-yedek
set -e
HEDEF=/var/backups/mirmotors
ZAMAN=$(date +%F-%H%M)
mkdir -p "$HEDEF"
cd "$(dirname "$0")"
docker compose exec -T db pg_dump -U mirmotors -Fc mirmotors > "$HEDEF/db-$ZAMAN.dump"
docker run --rm -v mirmotors_storage:/kaynak:ro -v "$HEDEF":/hedef alpine \
  tar czf "/hedef/dosyalar-$ZAMAN.tgz" -C /kaynak .
find "$HEDEF" -type f -mtime +7 -delete
echo "yedek tamam: $ZAMAN"
