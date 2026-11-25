#!/bin/sh
# Mir Motors — yedek sağlık kontrolü. Yedekler uzun süredir başarılı değilse HATA yazar ve 1 ile çıkar.
# Cron: her gün 09:00 (/etc/cron.d/mirmotors-yedek-saglik). Elle: sh /opt/mirmotors/yedek/saglik.sh
set -u
BETIK=saglik
. "$(dirname "$0")/ortak.sh"
izleme_yukle

simdi=$(date +%s)
kotu=0
kontrol() { # ad azami_saat
  if [ ! -f "$DURUM_DIZIN/$1-son-basarili" ]; then
    hata "$1: hiç başarılı çalışma yok ($(cat "$DURUM_DIZIN/$1-son" 2>/dev/null || echo 'kayıt yok'))"; kotu=1; return
  fi
  yas=$(( (simdi - $(cat "$DURUM_DIZIN/$1-son-basarili")) / 3600 ))
  if [ "$yas" -gt "$2" ]; then
    hata "$1: son başarı $yas saat önce (sınır $2 sa). Son durum: $(cat "$DURUM_DIZIN/$1-son" 2>/dev/null)"; kotu=1
  else
    log "$1: tamam (son başarı $yas saat önce)"
  fi
}
kontrol yerel 26
kontrol uzak 26
kontrol geri-test 192
log "disk: / için $(bos_mb /) MB boş"
[ "$(bos_mb /)" -ge 2048 ] || { hata "disk 2 GB'ın altında"; kotu=1; }
exit "$kotu"
