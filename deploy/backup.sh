#!/bin/sh
# Geriye uyumluluk: yerel gece yedeği artık deploy/yedek/yerel-yedek.sh içinde (sunucuda /opt/mirmotors/yedek).
# Ayrıntı: deploy/FELAKET_KURTARMA.md
if [ -f /opt/mirmotors/yedek/yerel-yedek.sh ]; then exec /bin/sh /opt/mirmotors/yedek/yerel-yedek.sh "$@"; fi
exec /bin/sh "$(dirname "$0")/yedek/yerel-yedek.sh" "$@"
