# Mir Motors — Kendi Sunucumuzda (VDS) Çalıştırma

Vercel yerine tek bir Ubuntu sunucusunda: PostgreSQL + uygulama + Caddy (HTTPS), hepsi Docker'da.
EİDS entegrasyonu Bakanlığa bildirilen **sabit çıkış IP'si** istediği için bu yol seçildi (Vercel'de sabit IP yalnızca ücretli planlarda).

> Sunucu IP'si, şifreler ve SSH anahtarı bu depoda **yoktur**. Proje sahibinden alınır.

## Sunucu

| | |
|---|---|
| Sağlayıcı | Febzen (Ryzen VDS, 4 çekirdek, 4 GB RAM, 40 GB disk) |
| İşletim sistemi | Ubuntu 24.04 LTS |
| Giriş | Yalnızca SSH anahtarı (şifreyle giriş kapalı), root |
| Güvenlik duvarı | ufw: yalnızca 22, 80, 443 açık; fail2ban açık; otomatik güvenlik güncellemeleri açık |
| Dışarı çıkış | Sunucunun kendi IP'si (EİDS formundaki "Çıkış Kaynak Statik IP"); `ws.gtb.gov.tr:8443` erişimi doğrulandı |

## Klasörler (sunucuda)

| Yol | İçerik |
|---|---|
| `/opt/mirmotors/app` | Uygulama kaynak kodu (bu depo) |
| `/opt/mirmotors/app/deploy/.env` | Gizli değerler (yalnızca root okur) — şablon: `deploy/env.example` |
| `/var/backups/mirmotors` | Gece yedekleri (veritabanı + yüklenen dosyalar, 7 gün, yalnız root) |
| `/opt/mirmotors/yedek` | Yedekleme script'leri (uygulama güncellemesinden etkilenmez) |
| `/etc/mirmotors-yedek` | Uzak yedek ayarı ve şifreleme parolası (yalnız root) |
| Docker birimleri | `mirmotors_pgdata` (veritabanı), `mirmotors_storage` (yüklenen dosyalar), `mirmotors_caddy_data` (SSL sertifikaları) |

## Servisler (`deploy/docker-compose.yml`)

- **db** — PostgreSQL 17. Portu dışarı açık değildir.
- **app** — Next.js uygulaması. Açılışta yalnızca `prisma migrate deploy` çalışır (veri silmez, seed çalıştırmaz).
  Dosyalar sunucu diskinde (`storage/`); Vercel Blob kullanılmaz. CRM kendi giriş sayfasıyla korunur; tarayıcı şifre penceresi (HTTP Basic) yalnız `DEMO_ACCESS_SCOPE=crm|all` verilirse açılır.
- **caddy** — 80/443, SSL'i kendisi alır ve yeniler. Sunucudaki diğer projelerle ortak (aşağıda "Ortak Caddyfile").

## Güncelleme (yeni sürümü yayına alma)

Bilgisayarda, proje klasöründe (değişiklikler commit edilmiş olmalı):

```bash
git archive --format=tar HEAD | ssh root@<SUNUCU_IP> 'rm -rf /opt/mirmotors/app.yeni && mkdir -p /opt/mirmotors/app.yeni && tar -x -C /opt/mirmotors/app.yeni && cp /opt/mirmotors/app/deploy/.env /opt/mirmotors/app/deploy/Caddyfile /opt/mirmotors/app.yeni/deploy/ && rm -rf /opt/mirmotors/app.eski && mv /opt/mirmotors/app /opt/mirmotors/app.eski && mv /opt/mirmotors/app.yeni /opt/mirmotors/app'
```

```bash
ssh root@<SUNUCU_IP> 'cd /opt/mirmotors/app/deploy && docker compose up -d --build'
```

Veritabanı ve dosyalar Docker birimlerinde durduğu için güncelleme veri silmez.

## Alan adı ve HTTPS

Kurulu (16.11.2026): `https://mirmotors.com.tr`, Let's Encrypt, `www` ve IP → ana alan adı.

**Ortak Caddyfile:** Sunucudaki `/opt/mirmotors/app/deploy/Caddyfile` başka projelerin sitelerini de
(kaderkocbulut.com, berberiz.tr) içerir; git'te tutulmaz, deploy'da üzerine yazılmamalıdır
(yukarıdaki komut onu yeni klasöre taşır). Mir Motors blokları için kaynak: `deploy/caddy-mirmotors.conf`.
Değişiklikten sonra: `docker compose restart caddy`.

1. Alan adının DNS'inde `A` kaydı → sunucu IP'si (`@` ve `www`).
2. Sunucudaki `deploy/.env` içinde `COOKIE_SECURE="1"`.
3. EİDS başvurusundaki ReturnURL bu alan adıyla verilir.

## İlk veri

Boş veritabanına örnek stok (3 personel + 11 araç), personel şifresi `DEMO_STAFF_PASSWORD`'dan:

```bash
docker compose exec -e DEMO_STAFF_PASSWORD='...' app npm run db:seed:cloud
```

Veritabanında veri varsa hiçbir şey yapmaz. `npm run demo / setup / db:reset` sunucuda çalışmaz (yerel olmayan veritabanında durur).

## Akşam özeti (CRM bildirimi)

- Her akşam 19:00'da (`/etc/cron.d/mirmotors-ozet`) abone personele "Günün özeti" bildirimi gider: son 24 saatteki kayıt/yayın/opsiyon/satış sayıları, bekleyen işler, WhatsApp'tan yazan kişi sayısı.
- İstek kapsayıcının içinden `CRON_SECRET` ile yapılır (anahtar sunucudan çıkmaz). Elle denemek için:

```bash
cd /opt/mirmotors/app/deploy && docker compose exec -T app node -e 'fetch("http://127.0.0.1:3000/api/cron/gunluk-ozet",{method:"POST",headers:{authorization:"Bearer "+process.env.CRON_SECRET}}).then(r=>{console.log(r.status);process.exit(r.ok?0:1)})'
```

## Yedek ve geri yükleme

- Her gece 03:30'da yerel yedek, 03:40'tan sonra şifreli uzak yedek (restic), haftalık otomatik geri yükleme testi.
  Script'ler `/opt/mirmotors/yedek` (kaynak: `deploy/yedek/`). Mimari, uzak depo bağlama ve tam felaket kurtarma
  adımları: **`deploy/FELAKET_KURTARMA.md`**.
- Veritabanını yerel yedekten geri yükleme:

```bash
docker compose exec -T db pg_restore -U mirmotors -d mirmotors --clean --if-exists < /var/backups/mirmotors/db-<tarih>.dump
```

## Faydalı komutlar (sunucuda, `/opt/mirmotors/app/deploy` içinde)

| Komut | Görev |
|---|---|
| `docker compose ps` | Servis durumu |
| `docker compose logs app --tail 100` | Uygulama günlüğü |
| `docker compose restart app` | Uygulamayı yeniden başlat |
| `sh backup.sh` | Elle yedek al |
