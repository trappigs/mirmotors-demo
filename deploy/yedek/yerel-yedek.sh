#!/bin/sh
# Mir Motors — yerel gece yedeği (veritabanı + yüklenen dosyalar), son 7 gün sunucuda tutulur.
# Cron: /etc/cron.d/mirmotors-yedek (03:30). Elle: sh /opt/mirmotors/yedek/yerel-yedek.sh
#
# Tutarlılık: önce veritabanı dökümü, sonra dosya arşivi alınır. Dosyalar UUID adlıdır ve üzerine yazılmaz;
# bu sırayla dökümdeki her dosya kaydının dosyası arşivde bulunur. İki adım arasında (genelde birkaç saniye)
# yüklenen dosya arşivde fazladan bulunabilir (zararsız); bu arada SİLİNEN dosya ise eksik olabilir.
set -eu
BETIK=yerel
. "$(dirname "$0")/ortak.sh"
izleme_yukle

SAKLA_GUN=${YEREL_SAKLA_GUN:-7}
ZAMAN=$(date +%F-%H%M)
DB_TMP="$YEREL_DIZIN/.db-$ZAMAN.dump.tmp"
DS_TMP="$YEREL_DIZIN/.dosyalar-$ZAMAN.tgz.tmp"
TAMAM=0

bitir() {
  kod=$?
  rm -f "$DB_TMP" "$DS_TMP" "$YEREL_DIZIN/.tablolar.tmp" "$YEREL_DIZIN/.sayim.tmp"
  if [ "$TAMAM" != 1 ]; then
    [ "$kod" = 0 ] && kod=1
    hata "yerel yedek BAŞARISIZ ($ZAMAN, çıkış kodu $kod)"
    durum_yaz yerel HATA "$ZAMAN cikis=$kod"
    ping_gonder "${HC_URL_YEREL:-}" fail
  fi
  exit "$kod"
}
trap bitir EXIT
trap 'exit 130' INT TERM

ping_gonder "${HC_URL_YEREL:-}" start
kilit_al 3600
mkdir -p "$YEREL_DIZIN"; chmod 700 "$YEREL_DIZIN"

# Disk: son yedek boyutunun 3 katı + 1 GB boş alan şartı.
son=$(du -cm "$YEREL_DIZIN"/db-*.dump "$YEREL_DIZIN"/dosyalar-*.tgz 2>/dev/null | tail -1 | cut -f1)
disk_kontrol "$YEREL_DIZIN" $(( ${son:-0} * 3 + ${YEDEK_MIN_BOS_MB:-1024} ))

DB=$(db_kapsayici)
[ -n "$DB" ] || { hata "veritabanı kapsayıcısı bulunamadı"; exit 1; }

log "veritabanı dökümü alınıyor"
# Tablo satır sayıları dökümle aynı anda alınır (geri yükleme testinde karşılaştırma için, yaklaşık).
docker exec "$DB" psql -U mirmotors -d mirmotors -Atc \
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1" \
  > "$YEREL_DIZIN/.tablolar.tmp"
: > "$YEREL_DIZIN/.sayim.tmp"
while read -r t; do
  n=$(docker exec "$DB" psql -U mirmotors -d mirmotors -Atc "select count(*) from \"$t\"")
  printf '%s %s\n' "$t" "$n" >> "$YEREL_DIZIN/.sayim.tmp"
done < "$YEREL_DIZIN/.tablolar.tmp"
rm -f "$YEREL_DIZIN/.tablolar.tmp"

dusuk_oncelik docker exec "$DB" pg_dump -U mirmotors -Fc mirmotors > "$DB_TMP"
# Döküm okunabilir mi? (içindekiler listesi çıkarılamazsa bozuk/eksiktir)
docker exec -i "$DB" pg_restore -l < "$DB_TMP" > /dev/null
[ -s "$DB_TMP" ] || { hata "döküm boş"; exit 1; }

log "dosya arşivi alınıyor"
STORAGE=$(storage_yolu)
[ -d "$STORAGE" ] || { hata "dosya deposu bulunamadı: $STORAGE"; exit 1; }
dusuk_oncelik tar czf "$DS_TMP" -C "$STORAGE" .
gzip -t "$DS_TMP"
dosya_sayisi=$(find "$STORAGE" -type f | wc -l)

mv "$DB_TMP" "$YEREL_DIZIN/db-$ZAMAN.dump"
mv "$DS_TMP" "$YEREL_DIZIN/dosyalar-$ZAMAN.tgz"
mv "$YEREL_DIZIN/.sayim.tmp" "$YEREL_DIZIN/sayim-$ZAMAN.txt"
echo "dosya_sayisi $dosya_sayisi" >> "$YEREL_DIZIN/sayim-$ZAMAN.txt"
(cd "$YEREL_DIZIN" && sha256sum "db-$ZAMAN.dump" "dosyalar-$ZAMAN.tgz" > "sha256-$ZAMAN.txt")

# Eski yerel yedekleri yalnız bugünkü yedek başarılıysa ve yalnız kendi dosya kalıplarımızla sil.
find "$YEREL_DIZIN" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'dosyalar-*.tgz' -o -name 'sayim-*.txt' -o -name 'sha256-*.txt' \) \
  -mtime +"$SAKLA_GUN" -delete

echo "$ZAMAN" > "$DURUM_DIZIN/yerel-son-zaman" 2>/dev/null || { mkdir -p "$DURUM_DIZIN"; echo "$ZAMAN" > "$DURUM_DIZIN/yerel-son-zaman"; }
TAMAM=1
durum_yaz yerel TAMAM "$ZAMAN db=$(du -h "$YEREL_DIZIN/db-$ZAMAN.dump" | cut -f1) dosya=$dosya_sayisi"
ping_gonder "${HC_URL_YEREL:-}"
log "yerel yedek tamam: $ZAMAN (veritabanı $(du -h "$YEREL_DIZIN/db-$ZAMAN.dump" | cut -f1), $dosya_sayisi dosya)"
