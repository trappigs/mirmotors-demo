# Mir Motors yedekleme — ortak işlevler. Doğrudan çalıştırılmaz; diğer betikler "." ile yükler.
# POSIX sh (dash) uyumludur. Gizli değer yazdırmaz.

umask 077
export LC_ALL=C

DURUM_DIZIN=${YEDEK_DURUM_DIZIN:-/var/lib/mirmotors-yedek}
AYAR_DIZIN=${YEDEK_AYAR_DIZIN:-/etc/mirmotors-yedek}
YEREL_DIZIN=${YEDEK_DIZIN:-/var/backups/mirmotors}
KILIT=${YEDEK_KILIT:-/run/lock/mirmotors-yedek.lock}
COMPOSE_PROJE=mirmotors
STORAGE_HACIM=${YEDEK_STORAGE_HACIM:-mirmotors_storage}

log() { printf '%s [%s] %s\n' "$(date '+%F %T')" "${BETIK:-yedek}" "$*"; }
hata() { log "HATA: $*"; }

# Aynı anda tek yedek işlemi: yerel, uzak ve geri yükleme testi aynı kilidi paylaşır.
kilit_al() {
  exec 9>"$KILIT"
  if ! flock -w "${YEDEK_KILIT_SN:-${1:-3600}}" 9; then
    hata "başka bir yedek işlemi sürüyor (kilit: $KILIT); vazgeçildi"
    exit 75
  fi
}

# Durum dosyası: <ad>-son = "TAMAM|HATA <zaman> <açıklama>"; <ad>-son-basarili = son başarı zamanı (epoch).
durum_yaz() { # ad sonuc aciklama
  mkdir -p "$DURUM_DIZIN"
  printf '%s %s %s\n' "$2" "$(date '+%F %T')" "$3" > "$DURUM_DIZIN/$1-son"
  [ "$2" = TAMAM ] && date +%s > "$DURUM_DIZIN/$1-son-basarili"
  return 0
}

# Gizli dosya yalnız root'a ait ve 600/400 izinli olmalı; değilse yüklenmez.
izin_kontrol() {
  [ -f "$1" ] || return 1
  sahip=$(stat -c %u "$1"); mod=$(stat -c %a "$1")
  if [ "$sahip" != 0 ] || { [ "$mod" != 600 ] && [ "$mod" != 400 ]; }; then
    hata "$1 izinleri güvensiz (sahip=$sahip mod=$mod; root ve 600 olmalı)"
    return 2
  fi
}

# İsteğe bağlı izleme (ör. healthchecks.io): izleme.env içinde HC_URL_YEREL / HC_URL_UZAK / HC_URL_TEST.
izleme_yukle() {
  if [ -f "$AYAR_DIZIN/izleme.env" ] && izin_kontrol "$AYAR_DIZIN/izleme.env"; then
    set -a; . "$AYAR_DIZIN/izleme.env"; set +a
  fi
}
ping_gonder() { # url [start|fail]
  [ -n "${1:-}" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "$1${2:+/$2}" || log "uyarı: izleme bildirimi gönderilemedi"
}

db_kapsayici() {
  if [ -n "${YEDEK_DB_KAPSAYICI:-}" ]; then echo "$YEDEK_DB_KAPSAYICI"; return; fi
  docker ps -q -f "label=com.docker.compose.project=$COMPOSE_PROJE" -f label=com.docker.compose.service=db | head -1
}
storage_yolu() { docker volume inspect -f '{{.Mountpoint}}' "$STORAGE_HACIM"; }
bos_mb() { df -Pm "$1" | awk 'NR==2{print $4}'; }

# Diskin dolmasını önler: gerekli MB yoksa çıkar.
disk_kontrol() { # dizin gerekli_mb
  b=$(bos_mb "$1")
  if [ "$b" -lt "$2" ]; then
    hata "disk alanı yetersiz: $1 için $2 MB gerekli, $b MB boş"
    return 1
  fi
}

# Kaynak kullanımını sınırlar (diğer projeler etkilenmesin).
dusuk_oncelik() { nice -n 15 ionice -c3 "$@"; }
