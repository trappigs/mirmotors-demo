#!/bin/sh
# Mir Motors yedekleme kurulumu (sunucuda root ile). Tekrar çalıştırmak güvenlidir.
# Yalnız Mir Motors'a ait dosyaları yazar: /opt/mirmotors/yedek, /etc/mirmotors-yedek,
# /var/lib/mirmotors-yedek, /etc/cron.d/mirmotors-{yedek,uzak-yedek,geri-test,yedek-saglik}, /etc/logrotate.d/mirmotors-yedek.
# Başka projelerin kapsayıcı/hacim/ayarlarına dokunmaz.
set -eu
KAYNAK=$(cd "$(dirname "$0")" && pwd)
HEDEF=/opt/mirmotors/yedek

if ! command -v restic > /dev/null 2>&1; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq restic
fi
restic version

install -d -m 755 "$HEDEF"
for f in ortak.sh yerel-yedek.sh uzak-yedek.sh geri-yukleme-testi.sh saglik.sh restic.env.example izleme.env.example; do
  install -m 755 "$KAYNAK/$f" "$HEDEF/$f"
done
install -d -m 700 /etc/mirmotors-yedek /var/lib/mirmotors-yedek /var/cache/restic-mirmotors
install -d -m 700 /var/backups/mirmotors
# Mevcut yerel yedekler kişisel veri içerir: yalnız root okusun.
chmod 600 /var/backups/mirmotors/* 2>/dev/null || true

C='SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
# /bin/sh ile çağrılır: dosyanın çalıştırma izni kaybolsa da çalışır.
printf '%s\n30 3 * * * root /bin/sh %s/yerel-yedek.sh >> /var/log/mirmotors-yedek.log 2>&1\n' "$C" "$HEDEF" > /etc/cron.d/mirmotors-yedek
printf '%s\n40 3 * * * root /bin/sh %s/uzak-yedek.sh >> /var/log/mirmotors-uzak-yedek.log 2>&1\n' "$C" "$HEDEF" > /etc/cron.d/mirmotors-uzak-yedek
printf '%s\n30 5 * * 0 root /bin/sh %s/geri-yukleme-testi.sh >> /var/log/mirmotors-geri-test.log 2>&1\n' "$C" "$HEDEF" > /etc/cron.d/mirmotors-geri-test
printf '%s\n0 9 * * * root /bin/sh %s/saglik.sh >> /var/log/mirmotors-yedek-saglik.log 2>&1\n' "$C" "$HEDEF" > /etc/cron.d/mirmotors-yedek-saglik
chmod 644 /etc/cron.d/mirmotors-yedek /etc/cron.d/mirmotors-uzak-yedek /etc/cron.d/mirmotors-geri-test /etc/cron.d/mirmotors-yedek-saglik

cat > /etc/logrotate.d/mirmotors-yedek <<'EOF'
/var/log/mirmotors-yedek.log /var/log/mirmotors-uzak-yedek.log /var/log/mirmotors-geri-test.log /var/log/mirmotors-yedek-saglik.log {
  monthly
  rotate 12
  compress
  missingok
  notifempty
}
EOF

echo "kurulum tamam. Uzak depo: $( [ -f /etc/mirmotors-yedek/restic.env ] && echo yapılandırılmış || echo 'YAPILANDIRILMADI (/etc/mirmotors-yedek/restic.env)')"
