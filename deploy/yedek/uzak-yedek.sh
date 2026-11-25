#!/bin/sh
# Mir Motors — sunucu dışı yedek (restic). Yerel gece yedeği BAŞARIYLA bittikten sonra çalışır.
# Cron: /etc/cron.d/mirmotors-uzak-yedek. Elle: sh /opt/mirmotors/yedek/uzak-yedek.sh
#
# Ne gider: o geceki veritabanı dökümü (+ sha256, satır sayıları) ve dosya deposu (fotoğraf, video, özel belgeler).
# Şifreleme: restic, veriyi sunucudan çıkmadan AES-256 ile şifreler; parola yalnız sunucuda ve sahibinde.
# Aktarım: yalnız https (S3/B2) veya sftp kabul edilir.
# Saklama: 30 günlük + 8 haftalık + 6 aylık; silme yalnız yedek ve doğrulama başarılıysa yapılır.
set -eu
BETIK=uzak
. "$(dirname "$0")/ortak.sh"
izleme_yukle

AYAR="$AYAR_DIZIN/restic.env"
HAZIRLIK="$DURUM_DIZIN/hazirlik/db"
TAMAM=0

bitir() {
  kod=$?
  rm -rf "$HAZIRLIK" "$DURUM_DIZIN/.restic-backup.json"   # sert bağlantı eski dökümü diskte tutmasın
  if [ "$TAMAM" != 1 ]; then
    [ "$kod" = 0 ] && kod=1
    hata "uzak yedek BAŞARISIZ (çıkış kodu $kod)"
    durum_yaz uzak HATA "cikis=$kod"
    ping_gonder "${HC_URL_UZAK:-}" fail
  fi
  exit "$kod"
}
trap bitir EXIT
trap 'exit 130' INT TERM
ping_gonder "${HC_URL_UZAK:-}" start

# --- Yapılandırma ---
if [ ! -f "$AYAR" ]; then
  hata "uzak depo yapılandırılmadı: $AYAR yok (bkz. deploy/yedek/restic.env.example)"
  exit 78
fi
izin_kontrol "$AYAR" || exit 78
set -a; . "$AYAR"; set +a
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY tanımlı değil}"
[ -n "${RESTIC_PASSWORD_FILE:-}" ] && { izin_kontrol "$RESTIC_PASSWORD_FILE" || exit 78; }
case "$RESTIC_REPOSITORY" in
  s3:https://*|b2:*|sftp:*|rest:https://*|azure:*|gs:*) ;;
  *) if [ "${YEDEK_TEST_MODU:-0}" = 1 ]; then log "TEST MODU: depo $RESTIC_REPOSITORY";
     else hata "güvensiz/izin verilmeyen depo adresi (https veya sftp gerekli)"; exit 78; fi ;;
esac
export RESTIC_CACHE_DIR=${RESTIC_CACHE_DIR:-/var/cache/restic-mirmotors}
export GOMAXPROCS=${GOMAXPROCS:-1}
HOST_ADI=mirmotors-vds
UPLOAD=${YEDEK_UPLOAD_KBPS:-4096}
DENEME_BEKLE=${YEDEK_DENEME_BEKLE:-60 300 900}   # saniye; 3 yeniden deneme

# --- Yerel yedeğin bugün başarıyla bitmesini bekle (sabit gecikmeye güvenilmez) ---
BUGUN=$(date +%F)
BEKLE_DK=${UZAK_BEKLE_DK:-120}
i=0
while :; do
  durum=$(cat "$DURUM_DIZIN/yerel-son" 2>/dev/null || true)
  zaman=$(cat "$DURUM_DIZIN/yerel-son-zaman" 2>/dev/null || true)
  case "$durum" in
    "TAMAM $BUGUN"*) case "$zaman" in "$BUGUN"*) break;; esac ;;
    "HATA $BUGUN"*) hata "bugünkü yerel yedek başarısız; eksik yedek gönderilmez"; exit 1 ;;
  esac
  if [ "$i" -ge "$BEKLE_DK" ]; then hata "bugünkü yerel yedek $BEKLE_DK dakikada tamamlanmadı"; exit 1; fi
  [ "$i" = 0 ] && log "yerel yedeğin bitmesi bekleniyor (en çok $BEKLE_DK dk)"
  sleep 60; i=$((i + 1))
done

kilit_al 3600

DB_DOSYA="$YEREL_DIZIN/db-$zaman.dump"
[ -s "$DB_DOSYA" ] || { hata "döküm bulunamadı: $DB_DOSYA"; exit 1; }
# Yerel dökümün bütünlüğü (yerel yedekte yazılan sha256 ile)
beklenen=$(grep " db-$zaman.dump\$" "$YEREL_DIZIN/sha256-$zaman.txt" | cut -d' ' -f1)
gercek=$(sha256sum "$DB_DOSYA" | cut -d' ' -f1)
[ -n "$beklenen" ] && [ "$beklenen" = "$gercek" ] || { hata "yerel döküm sha256 tutmuyor"; exit 1; }

STORAGE=$(storage_yolu)
[ -d "$STORAGE" ] || { hata "dosya deposu bulunamadı"; exit 1; }
disk_kontrol / "${YEDEK_MIN_BOS_MB:-1024}"

# Hazırlık: döküm sabit adla (sert bağlantı; kopya yer kaplamaz)
rm -rf "$HAZIRLIK"; mkdir -p "$HAZIRLIK"
ln "$DB_DOSYA" "$HAZIRLIK/db.dump" 2>/dev/null || cp "$DB_DOSYA" "$HAZIRLIK/db.dump"
cp "$YEREL_DIZIN/sayim-$zaman.txt" "$HAZIRLIK/sayim.txt"
printf '%s  db.dump\n' "$gercek" > "$HAZIRLIK/sha256.txt"
printf 'zaman=%s\nstorage=%s\nsunucu=%s\n' "$zaman" "$STORAGE" "$(hostname)" > "$HAZIRLIK/bilgi.txt"

yeniden_dene() { # komut...
  for bekle in $DENEME_BEKLE ""; do
    if "$@"; then return 0; fi
    [ -z "$bekle" ] && return 1
    log "başarısız; $bekle sn sonra yeniden denenecek"
    sleep "$bekle"
    restic unlock > /dev/null 2>&1 || true
  done
}

# Depoya erişim; depo yoksa ilk kez oluşturulur (var olan depoda init zaten reddedilir).
depo_hazir() {
  restic cat config > /dev/null 2>&1 && return 0
  log "uzak depo okunamadı; yoksa oluşturuluyor"
  restic init > /dev/null
}
yeniden_dene depo_hazir || { hata "uzak depoya erişilemedi"; exit 1; }

log "yükleniyor ($zaman)"
CIKTI="$DURUM_DIZIN/.restic-backup.json"
# Felaket kurtarma için sunucu ayarları da (şifreli) gider: uygulama .env'i ve ortak Caddyfile.
# Bunlar olmadan yeni sunucuda uygulama ayağa kalkmaz. İçerikleri log'a yazılmaz.
EK=""
for f in ${YEDEK_EK_YOLLAR:-/opt/mirmotors/app/deploy/.env /opt/mirmotors/app/deploy/Caddyfile}; do
  [ -f "$f" ] && EK="$EK $f"
done
yedekle() {
  # shellcheck disable=SC2086
  dusuk_oncelik restic backup --json --host "$HOST_ADI" --tag mirmotors --tag "gece-$zaman" \
    --limit-upload "$UPLOAD" "$HAZIRLIK" "$STORAGE" $EK > "$CIKTI"
}
yeniden_dene yedekle || { hata "restic backup başarısız"; exit 1; }
SNAP=$(grep -o '"snapshot_id":"[0-9a-f]*"' "$CIKTI" | tail -1 | cut -d'"' -f4)
[ -n "$SNAP" ] || { hata "anlık görüntü kimliği alınamadı"; exit 1; }
log "anlık görüntü: $SNAP"

# --- Doğrulama 1: döküm uzak depodan okunup sha256 karşılaştırılır ---
uzak_sha=$(restic dump "$SNAP" "$HAZIRLIK/db.dump" | sha256sum | cut -d' ' -f1)
[ "$uzak_sha" = "$gercek" ] || { hata "uzak depodaki döküm sha256 tutmuyor"; exit 1; }
# Doğrulama 2: dosya sayısı
yerel_n=$(find "$STORAGE" -type f | wc -l)
uzak_n=$(restic ls "$SNAP" "$STORAGE" | grep -c "^$STORAGE/" || true)
# restic ls dizinleri de listeler; dosya sayısı en az yerel kadar olmalı
[ "$uzak_n" -ge "$yerel_n" ] || { hata "uzak anlık görüntüde dosya eksik ($uzak_n < $yerel_n)"; exit 1; }
# Doğrulama 3: depo yapısı + verinin dönüşümlü 1/7'si (bir haftada tamamı okunur)
gun=$(( $(date +%u) ))
yeniden_dene restic check --read-data-subset="$gun/7" || { hata "restic check başarısız"; exit 1; }

# --- Saklama: yalnız buraya kadar her şey başarılıysa ---
# group-by host: yol listesi değişse (ör. .env yoksa) de saklama tek grup üzerinden uygulanır.
yeniden_dene restic forget --host "$HOST_ADI" --tag mirmotors --group-by host \
  --keep-daily 30 --keep-weekly 8 --keep-monthly 6 --prune || { hata "saklama/temizlik başarısız (yedek yine de alındı)"; exit 1; }

boyut=$(restic stats --mode raw-data 2>/dev/null | awk -F': *' '/Total Size/{print $2}' | head -1)
TAMAM=1
durum_yaz uzak TAMAM "$zaman snap=$SNAP depo=${boyut:-?}"
ping_gonder "${HC_URL_UZAK:-}"
log "uzak yedek tamam: $zaman, anlık görüntü $SNAP, depo boyutu ${boyut:-?}"
