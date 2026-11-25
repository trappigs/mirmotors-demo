# Mir Motors — Yedekleme ve Felaket Kurtarma

Son güncelleme: 20.11.2026. Sunucu IP'si, parolalar ve erişim anahtarları bu belgede **yoktur**.

## 1. Durum özeti

| Katman | Durum (20.11.2026) |
|---|---|
| Yerel gece yedeği (sunucu diski, 7 gün) | **Çalışıyor.** 20.11 öncesinde hiç çalışmamıştı: cron, çalıştırma izni olmayan `backup.sh`'yi doğrudan çağırıyordu ve 16 gece "Permission denied" verdi. Elde yalnız 16.11'de elle alınmış tek yedek vardı. Düzeltildi; 20.11 23:52'de gerçek yedek alındı. |
| Uzak (sunucu dışı) yedek | **Kurulu, depo bilgisi bekleniyor.** Script'ler, zamanlama ve şifreleme parolası sunucuda. `/etc/mirmotors-yedek/restic.env` eklenince ilk gece kendiliğinden başlar. |
| Otomatik geri yükleme testi | Kurulu (haftalık). Uzak depo bağlanınca çalışır. |
| Sağlık kontrolü | Kurulu (her gün 09:00). Uzak depo bağlanana kadar "HATA" yazar (beklenen). |
| Uyarı kanalı (e-posta vb.) | **Yok.** Hatalar yalnız log'a yazılır. İsteğe bağlı healthchecks.io bağlantısı hazır (bkz. 7). |

## 2. Mimari

```
03:30  yerel-yedek.sh ── pg_dump -Fc (salt okuma) ──► /var/backups/mirmotors/db-<zaman>.dump
                    └─ dosya deposu tar.gz      ──► /var/backups/mirmotors/dosyalar-<zaman>.tgz
                       + sha256 + tablo satır sayıları; doğrulanmadan "tamam" sayılmaz; 7 günden eskiler silinir
03:40  uzak-yedek.sh ── bugünkü yerel yedek TAMAM olana kadar bekler (en çok 2 saat; HATA ise göndermez)
                    └─ restic (sunucuda AES-256 şifreleme) ──https/sftp──► uzak depo
                       gönderilenler: döküm, dosya deposu (fotoğraf/video/ruhsat/ekspertiz), .env, Caddyfile
                       doğrulama: döküm uzaktan geri okunup sha256 karşılaştırılır, dosya sayısı, restic check (1/7 veri/gün)
                       saklama (yalnız hepsi başarılıysa): 30 günlük + 8 haftalık + 6 aylık
Pazar 05:30  geri-yukleme-testi.sh ── uzaktan indirir ► ağsız geçici PostgreSQL 17 ► tablo/satır/dosya referansı kontrolü ► siler
09:00  saglik.sh ── son başarılar 26 saatten (test için 8 günden) eskiyse HATA, disk < 2 GB ise HATA
```

**Neden restic + S3 uyumlu depo:** tek ikili dosya (Ubuntu paketi), veriyi sunucudan çıkmadan şifreler,
tekrar eden veriyi bir kez saklar (fotoğraflar her gece yeniden yüklenmez), saklama/temizlik ve bütünlük
kontrolü içinde. Alternatifler: Borg (S3 desteklemez, yalnız SSH), rclone (şifreleme var ama anlık görüntü/
saklama yok), sağlayıcı anlık görüntüsü (Febzen; aynı sağlayıcıda kalır, bağımsız değil).

**Tutarlılık sınırı:** Döküm ile dosya arşivi aynı anda değil, art arda alınır (birkaç saniye). Dosyalar UUID
adlıdır ve üzerine yazılmaz; döküm önce alındığı için dökümdeki her kaydın dosyası arşivde bulunur. Bu birkaç
saniyede yüklenen dosya fazladan gelebilir (zararsız); bu arada silinen dosya eksik olabilir (gece 03:30'da
pratikte olmaz). Uzak yedek, dosya deposunu yerel tgz'den değil canlı klasörden alır (restic tekrar yüklemesin
diye); aradaki fark aynı kuralla sınırlıdır.

**Kaynak sınırları:** `nice 15` + `ionice idle`, restic tek çekirdek (`GOMAXPROCS=1`), yükleme 4 MB/sn sınırı,
test veritabanı 512 MB bellek ve 1 çekirdek. Disk: yerel yedek öncesi (son yedek×3 + 1 GB), uzak yedek öncesi 1 GB,
geri yükleme testi öncesi (boyut×2 + 512 MB) boş alan şartı. Tek kilit (`/run/mirmotors-yedek.lock`, yalnız root): üç işlem
aynı anda çalışmaz.

## 3. Dosyalar

| Depoda | Sunucuda | Görev |
|---|---|---|
| `deploy/yedek/ortak.sh` | `/opt/mirmotors/yedek/` | Ortak işlevler (kilit, durum, izin kontrolü) |
| `deploy/yedek/yerel-yedek.sh` | 〃 | Yerel gece yedeği |
| `deploy/yedek/uzak-yedek.sh` | 〃 | Sunucu dışı yedek + doğrulama + saklama |
| `deploy/yedek/geri-yukleme-testi.sh` | 〃 | İzole geri yükleme testi |
| `deploy/yedek/saglik.sh` | 〃 | Gecikme/disk kontrolü |
| `deploy/yedek/kur.sh` | — | Kurulum (tekrar çalıştırılabilir) |
| `deploy/yedek/restic.env.example` | `/etc/mirmotors-yedek/restic.env` (600) | Depo adresi + erişim anahtarı |
| — | `/etc/mirmotors-yedek/restic-parola` (600) | Şifreleme parolası |
| `deploy/yedek/izleme.env.example` | `/etc/mirmotors-yedek/izleme.env` (600, isteğe bağlı) | Uyarı adresleri |
| `deploy/backup.sh` | — | Eski komut uyumluluğu (`sh backup.sh` → yerel-yedek.sh) |

Script'ler uygulama klasörünün **dışında** (`/opt/mirmotors/yedek`) durur: uygulama güncellemesi onları silmez,
yedek için uygulama yeniden derlenmez. Cron `/bin/sh` ile çağırır (çalıştırma izni kaybolsa da çalışır).

Durum: `/var/lib/mirmotors-yedek/{yerel,uzak,geri-test}-son`. Log'lar: `/var/log/mirmotors-yedek.log`,
`mirmotors-uzak-yedek.log`, `mirmotors-geri-test.log`, `mirmotors-yedek-saglik.log` (aylık döner, 12 ay).

Güncelleme sonrası script değişikliği: `deploy/yedek` klasörünü sunucuya kopyalayıp `sh kur.sh`.

## 4. Uzak depoyu bağlama (bir kez)

Gerekenler (sağlayıcıya göre biri):

| Sağlayıcı | Gerekli bilgiler |
|---|---|
| **Backblaze B2 (önerilen)** | Kova adı, bölge uç noktası (ör. `s3.eu-central-003.backblazeb2.com`), **yalnız bu kovaya** yetkili Application Key (keyID + applicationKey) |
| Cloudflare R2 | Hesap kimliği, kova adı, yalnız bu kovaya "Object Read & Write" API token (Access Key ID + Secret) |
| Hetzner Storage Box | Kullanıcı adı + sunucunun SSH açık anahtarının kutuya eklenmesi |

B2 önerisi: kovada "Keep all versions" ve yaşam döngüsü kuralı *silinen dosyayı 30 gün sonra kalıcı sil*.
Sunucu ele geçirilip yedekler silinse bile 30 gün geri alınabilir.

Kurulum (sunucuda root):

```bash
install -m 600 /dev/null /etc/mirmotors-yedek/restic.env
nano /etc/mirmotors-yedek/restic.env       # şablon: /opt/mirmotors/yedek/restic.env.example
/bin/sh /opt/mirmotors/yedek/uzak-yedek.sh # ilk çalıştırma depoyu oluşturur ve ilk yedeği gönderir
/bin/sh /opt/mirmotors/yedek/geri-yukleme-testi.sh
```

**Şifreleme parolası:** sunucuda `/etc/mirmotors-yedek/restic-parola`; bir kopyası proje sahibine verildi.
**Parola kaybolursa uzak yedekler açılamaz.** Sunucu silinirse parola yalnız sahibindeki kopyadan gelir:
parola yöneticisinde saklanmalıdır.

## 5. Felaket kurtarma: sunucu tamamen kayboldu

Hedef süre (tahmini, denenmedi): 1–2 saat. Veri kaybı: en çok son gece yedeğinden bu yana (≤ 24 saat).

1. Yeni Ubuntu 24.04 sunucu: Docker + `apt install restic`.
2. Parola yöneticisinden şifreleme parolasını al; `/etc/mirmotors-yedek/restic-parola` (600) ve
   `/etc/mirmotors-yedek/restic.env` (depo adresi + anahtar) dosyalarını oluştur.
3. Yedekleri listele ve indir:
   ```bash
   set -a; . /etc/mirmotors-yedek/restic.env; set +a
   restic snapshots --host mirmotors-vds
   restic restore latest --host mirmotors-vds --tag mirmotors --target /root/geri
   cd /root/geri/var/lib/mirmotors-yedek/hazirlik/db && sha256sum -c sha256.txt   # "db.dump: OK" olmalı
   ```
4. Uygulama kodunu `/opt/mirmotors/app`'e koy (VDS_KURULUM.md → Güncelleme). Ayar dosyalarını yedekten al:
   `cp /root/geri/opt/mirmotors/app/deploy/{.env,Caddyfile} /opt/mirmotors/app/deploy/` (Caddyfile diğer
   projelerin sitelerini de içerir; onlar ayrı taşınmıyorsa ilgili blokları çıkar).
5. Veritabanını boş kuruluma yükle:
   ```bash
   cd /opt/mirmotors/app/deploy && docker compose up -d db
   docker compose exec -T db pg_restore -U mirmotors -d mirmotors --no-owner --exit-on-error \
     < /root/geri/var/lib/mirmotors-yedek/hazirlik/db/db.dump
   ```
6. Dosyaları yükle:
   ```bash
   docker volume create mirmotors_storage
   docker run --rm -v mirmotors_storage:/hedef -v /root/geri/var/lib/docker/volumes/mirmotors_storage/_data:/kaynak:ro \
     alpine sh -c 'cp -a /kaynak/. /hedef/ && chown -R 1000:1000 /hedef'
   ```
7. `docker compose up -d --build`; alan adının DNS `A` kaydını yeni IP'ye çevir.
8. **EİDS:** Bakanlığa bildirilen sabit çıkış IP'si değişir; yeni IP ile başvuru güncellenmelidir.
9. `kur.sh` ile yedeklemeyi yeniden kur; `geri-yukleme-testi.sh` çalıştır.

Yalnız veritabanını geri almak (sunucu sağlam): yerel döküm daha hızlıdır:
`docker compose exec -T db pg_restore -U mirmotors -d mirmotors --clean --if-exists < /var/backups/mirmotors/db-<zaman>.dump`
(canlı veriyi değiştirir; önce yeni bir yerel yedek al).

## 6. Test kanıtı (20.11.2026)

Tamamı izole çalıştı: test klasörleri `/var/tmp/mm-yt`, test deposu yerel klasör (S3 yerine), geçici ağsız
PostgreSQL kapsayıcıları. Canlı veritabanına yalnız `pg_dump` (okuma) yapıldı. Test kaynakları silindi.

| # | Senaryo | Sonuç |
|---|---|---|
| T1 | Depo ayarı yokken uzak yedek reddedilir (çıkış 78) | Geçti |
| T2 | Veritabanı kapsayıcısı yokken yerel yedek başarısız, yarım dosya kalmaz | Geçti (ilk denemede yarım dosya kaldı; düzeltildi) |
| T4 | Ayar dosyası 644 iken reddedilir | Geçti |
| T5 | Bugünkü yerel yedek HATA iken uzak yedek gönderilmez | Geçti |
| T6 | Disk yetersizken yedek başlamaz | Geçti |
| T7 | Başka yedek sürerken ikincisi çalışmaz | Geçti |
| T8–T10 | Gerçek döküm → yerel yedek → uzak yedek + uzaktan sha256 + check + saklama (2 kez) | Geçti |
| T11 | İzole geri yükleme: 14 tablo, 11 araç, 3 personel; geçici kapsayıcı/klasör kalmadı | Geçti (4 sn) |
| T12 | Sağlık kontrolü | Geçti |
| T13 | Yanlış parola ile depo açılmaz | Geçti |
| T14 | Depo erişilemezken 2 yeniden deneme sonrası başarısız | Geçti |
| T15 | `http://` (şifresiz bağlantı) depo adresi reddedilir | Geçti |
| R1–R3 | Canlı DB'nin test kopyası + sahte dosyalar: eksik dosya ve bozuk dosya imzası **yakalandı**; düzeltilince test geçti | Geçti |
| S3 | Bilgisayarda S3 sunucusu (rclone) ile restic: init, yedek, `check --read-data`, saklama, geri yükleme sha256, yanlış parola reddi, depoda düz metin dosya adı yok | Geçti |
| — | `.env` ve Caddyfile anlık görüntüde (yalnız dosya adları kontrol edildi) | Geçti |

**Doğrulanmadı:** gerçek uzak sağlayıcıya (B2/R2/Hetzner) yükleme ve oradan geri yükleme — depo bilgisi yok.
Sıfır sunucuya tam kurtarma (bölüm 5) uçtan uca denenmedi.

## 7. Uyarılar

Varsayılan: hatalar log'a ve `/var/lib/mirmotors-yedek/*-son` dosyalarına yazılır; kimse bilgilendirilmez.
Önerilen: healthchecks.io (ücretsiz katman) üzerinde 3 kontrol (yerel günlük, uzak günlük, test haftalık) açıp
adresleri `/etc/mirmotors-yedek/izleme.env` (600) dosyasına yazmak. Yedek hata verirse **veya hiç çalışmazsa**
e-posta gelir. Gönderilen tek bilgi "başladı/bitti/hata" sinyalidir; veri gönderilmez.

## 8. Maliyet

Ölçülen veri (20.11.2026): veritabanı 8,4 MB (sıkıştırılmış döküm 43 KB), dosya deposu boş (fotoğraflar şimdilik
demo görselleri), uzak depo testte 1,1 MB.

| Sağlayıcı | Fiyat (Kasım 2026, sağlayıcı sayfası) | Bugünkü veriyle | 20 GB olursa |
|---|---|---|---|
| Backblaze B2 | 6,95 $/TB/ay, ilk 10 GB ücretsiz, indirme depolananın 3 katına kadar ücretsiz | 0 $ | ~0,07 $/ay |
| Cloudflare R2 | 0,015 $/GB/ay, ilk 10 GB ücretsiz, indirme ücretsiz | 0 $ | ~0,15 $/ay |
| Hetzner Storage Box BX11 | ~3,20 €/ay + KDV, 1 TB sabit | ~3,20 € | ~3,20 € |

20 GB bir **varsayımdır** (ör. ayda 50 araç × 20 fotoğraf + belge ≈ 0,5 GB/ay; video eklenirse çok daha fazla).
Restic tekrar eden veriyi bir kez saklar; 6 aylık saklama, silinen araçların dosyalarını 6 ay tutar.

**KVKK notu (hukuki değerlendirme değildir):** Ruhsat/ekspertiz gibi kişisel veriler yurt dışındaki bir depoya
gider; veri sunucuda şifrelenir ve anahtar yurt dışına çıkmaz. Yurt dışına aktarım şartları için hukuki görüş
alınmalı; Türkiye'de S3 uyumlu depolama sunan bir sağlayıcı da aynı script'lerle kullanılabilir.

## 9. Açık işler

1. Uzak depo hesabı ve erişim anahtarı (bölüm 4) — proje sahibi.
2. Şifreleme parolasının parola yöneticisine kaydedilmesi — proje sahibi.
3. Uyarı kanalı (bölüm 7) — isteğe bağlı.
4. Sunucu diski %79 dolu (7,5 GB boş). Docker derleme önbelleği ~17 GB geri kazanılabilir görünüyor ama ortak
   sunucuda olduğu için temizlenmedi; sahibinin onayıyla `docker builder prune` değerlendirilmeli.
5. Uzak depo bağlandıktan sonra gerçek uzak geri yükleme testinin sonucu bu belgeye eklenmeli.
