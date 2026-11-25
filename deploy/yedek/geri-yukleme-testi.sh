#!/bin/sh
# Mir Motors — izole geri yükleme testi. Canlı veritabanına ve canlı dosyalara DOKUNMAZ.
# Uzak depodan son anlık görüntüyü geçici klasöre indirir, ağsız ve geçici bir PostgreSQL kapsayıcısına
# yükler, tabloları/satır sayılarını ve dosya referanslarını kontrol eder, sonra kendi oluşturduklarını siler.
# Cron: haftada bir (/etc/cron.d/mirmotors-geri-test). Elle: sh /opt/mirmotors/yedek/geri-yukleme-testi.sh [snapshot]
set -eu
BETIK=geri-test
. "$(dirname "$0")/ortak.sh"
izleme_yukle

AYAR="$AYAR_DIZIN/restic.env"
SNAP_ISTEK=${1:-latest}
ID="$(date +%Y%m%d%H%M%S)-$$"
GECICI="/var/tmp/mirmotors-geri-test-$ID"
KAP="mirmotors-geri-test-$ID"
TAMAM=0
SORUN=0

bitir() {
  kod=$?
  docker rm -f "$KAP" > /dev/null 2>&1 || true
  case "$GECICI" in /var/tmp/mirmotors-geri-test-*) rm -rf "$GECICI" ;; esac
  if [ "$TAMAM" != 1 ]; then
    [ "$kod" = 0 ] && kod=1
    hata "geri yükleme testi BAŞARISIZ (çıkış kodu $kod)"
    durum_yaz geri-test HATA "cikis=$kod"
    ping_gonder "${HC_URL_TEST:-}" fail
  fi
  exit "$kod"
}
trap bitir EXIT
trap 'exit 130' INT TERM
ping_gonder "${HC_URL_TEST:-}" start

[ -f "$AYAR" ] || { hata "uzak depo yapılandırılmadı: $AYAR yok"; exit 78; }
izin_kontrol "$AYAR" || exit 78
set -a; . "$AYAR"; set +a
export RESTIC_CACHE_DIR=${RESTIC_CACHE_DIR:-/var/cache/restic-mirmotors}
export GOMAXPROCS=${GOMAXPROCS:-1}

kilit_al 7200

# Disk: geri yüklenecek boyutun 2 katı + 512 MB
boyut_b=$(restic stats --mode restore-size --host mirmotors-vds --tag mirmotors "$SNAP_ISTEK" --json | grep -o '"total_size":[0-9]*' | cut -d: -f2)
disk_kontrol /var/tmp $(( ${boyut_b:-0} / 1048576 * 2 + 512 ))

log "anlık görüntü indiriliyor: $SNAP_ISTEK"
mkdir -p "$GECICI"
t0=$(date +%s)
dusuk_oncelik restic restore "$SNAP_ISTEK" --host mirmotors-vds --tag mirmotors --target "$GECICI/geri" > /dev/null
HZ=$(find "$GECICI/geri" -type f -name bilgi.txt -path '*/hazirlik/db/*' | head -1)
[ -n "$HZ" ] || { hata "anlık görüntüde veritabanı dökümü yok"; exit 1; }
DBD=$(dirname "$HZ")
STORAGE_ESKI=$(sed -n 's/^storage=//p' "$DBD/bilgi.txt")
DOSYALAR="$GECICI/geri$STORAGE_ESKI"
log "yedek zamanı: $(sed -n 's/^zaman=//p' "$DBD/bilgi.txt")"

# 1) Döküm bütünlüğü
(cd "$DBD" && sha256sum -c --status sha256.txt) || { hata "döküm sha256 tutmuyor"; exit 1; }
log "döküm sha256: tamam"

# 2) Ağsız, geçici PostgreSQL 17'ye yükle
PAROLA=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
docker run -d --name "$KAP" --network none --memory 512m --cpus 1 \
  --label mirmotors.yedek-test=1 \
  -e POSTGRES_USER=mirmotors -e POSTGRES_DB=mirmotors -e POSTGRES_PASSWORD="$PAROLA" \
  postgres:17-alpine > /dev/null
n=0
until docker exec "$KAP" pg_isready -U mirmotors -d mirmotors > /dev/null 2>&1; do
  n=$((n + 1)); [ "$n" -gt 60 ] && { hata "test veritabanı açılmadı"; exit 1; }; sleep 1
done
sleep 2
if ! docker exec -i "$KAP" pg_restore -U mirmotors -d mirmotors --no-owner --exit-on-error < "$DBD/db.dump" 2> "$GECICI/restore.err"; then
  hata "pg_restore hatası:"; sed 's/^/    /' "$GECICI/restore.err" | head -20; exit 1
fi
log "veritabanı geri yüklendi"

sql() { docker exec "$KAP" psql -U mirmotors -d mirmotors -Atc "$1"; }

# 3) Tablolar ve satır sayıları (yedek anındaki sayımla)
while read -r tablo beklenen; do
  [ "$tablo" = dosya_sayisi ] && continue
  gercek=$(sql "select count(*) from \"$tablo\"" 2>/dev/null || echo YOK)
  if [ "$gercek" = YOK ]; then hata "tablo eksik: $tablo"; SORUN=1
  elif [ "$gercek" != "$beklenen" ]; then log "uyarı: $tablo satır sayısı $gercek (yedek anında $beklenen; döküm sırasında değişmiş olabilir)"
  fi
done < "$DBD/sayim.txt"
[ "$(sql 'select count(*) from "_prisma_migrations"')" -gt 0 ] || { hata "migration kaydı yok"; SORUN=1; }
[ "$(sql 'select count(*) from "User"')" -gt 0 ] || { hata "personel kaydı yok"; SORUN=1; }
log "tablolar: $(grep -vc '^dosya_sayisi' "$DBD/sayim.txt"), araç: $(sql 'select count(*) from "Vehicle"'), personel: $(sql 'select count(*) from "User"')"

# 4) Dosya arşivi ve veritabanı referansları
dosya_n=$(find "$DOSYALAR" -type f 2>/dev/null | wc -l)
beklenen_n=$(sed -n 's/^dosya_sayisi //p' "$DBD/sayim.txt")
[ "$dosya_n" -ge "${beklenen_n:-0}" ] || { hata "dosya sayısı eksik: $dosya_n < $beklenen_n"; SORUN=1; }
sql "select path from \"VehiclePhoto\" where path not like '/%'
     union all select \"videoPath\" from \"Vehicle\" where \"videoPath\" is not null and \"videoPath\" not like '/%'
     union all select \"expertisePdfPath\" from \"Vehicle\" where \"expertisePdfPath\" is not null and \"expertisePdfPath\" not like '/%'
     union all select path from \"VehicleDocument\"" > "$GECICI/referanslar.txt"
ref_n=0; eksik=0
while read -r yol; do
  [ -n "$yol" ] || continue
  ref_n=$((ref_n + 1))
  if [ ! -f "$DOSYALAR/public/$yol" ] && [ ! -f "$DOSYALAR/private/$yol" ]; then
    eksik=$((eksik + 1)); [ "$eksik" -le 10 ] && log "eksik dosya: $yol"
  fi
done < "$GECICI/referanslar.txt"
[ "$eksik" = 0 ] || { hata "$eksik / $ref_n referanslı dosya yedekte yok"; SORUN=1; }
# Görsel dosyaların imzası (bozuk dosya kontrolü, ilk 200)
bozuk=0
find "$DOSYALAR" -type f \( -name '*.jpg' -o -name '*.webp' -o -name '*.png' -o -name '*.pdf' \) 2>/dev/null | head -200 > "$GECICI/imza.txt"
while read -r f; do
  bas=$(head -c 5 "$f" | od -An -tx1 | tr -d ' \n')
  case "$bas" in ffd8ff*|89504e47*|52494646*|255044462d) ;; *) bozuk=$((bozuk + 1)) ;; esac
done < "$GECICI/imza.txt"
[ "$bozuk" = 0 ] || { hata "$bozuk dosyanın imzası bozuk"; SORUN=1; }
log "dosyalar: $dosya_n dosya, $ref_n veritabanı referansı, eksik $eksik, bozuk $bozuk"

[ "$SORUN" = 0 ] || exit 1
sure=$(( $(date +%s) - t0 ))
TAMAM=1
durum_yaz geri-test TAMAM "sure=${sure}sn tablo=$(grep -vc '^dosya_sayisi' "$DBD/sayim.txt") dosya=$dosya_n ref=$ref_n"
ping_gonder "${HC_URL_TEST:-}"
log "geri yükleme testi BAŞARILI (${sure} sn)"
