# Mir Motors — Kurulum ve Geliştirmeye Devam Rehberi (Burak için)

> ## ⚠️ ÖNCE BUNU OKU
> - **`npm run demo`, `npm run setup` ve `npm run db:reset` veritabanındaki TÜM verileri siler** ve örnek veriyi baştan yükler.
>   Eklediğin araçlar, yüklediğin dosyalar, satış kayıtları gider. Verini korumak için sunucuyu `npm start` (derlenmişse) veya `npm run dev` ile başlat.
> - Bu üç komut yalnızca **bu bilgisayardaki** (localhost) veritabanında çalışır; canlı (Neon) veritabanına bağlıysan çalışmadan durur.
>   Yine de canlı veritabanının adresini yerel `.env` / `.env.local` dosyana **koyma** (aşağıda 8. bölüm).
> - Bu depoda gerçek şifre veya API anahtarı yoktur. Canlı ortamın şifrelerini proje sahibinden güvenli bir kanalla iste.

## 0. Gereksinimler

- **Node.js 20 veya üstü** (24 ile test edildi) ve npm
- **Git** (GitHub'dan alacaksan)
- **Yerel PostgreSQL** — iki seçenek:
  - Kurulum gerektirmeyen: `npx prisma dev` (Prisma'nın yerel PostgreSQL'i; projeyle birlikte gelir)
  - Docker: `postgres:16` imajı
- İsteğe bağlı: Vercel CLI (`npm i -g vercel`) — yalnızca canlı ortamla çalışırken

> Kurulum gerektirmeyen en basit yol SQLite'lı ilk sürümdür (`master` dalı: `npm install` → `npm run demo`).
> Ama canlı demo ve geliştirmenin devamı **`vercel-deploy`** dalındadır; aşağıdaki adımlar bu dal içindir.

## 1. Projeyi al

**GitHub'dan** (proje sahibi seni özel depoya eklediyse):

```bash
git clone -b vercel-deploy <depo-adresi> mirmotors
```

```bash
cd mirmotors
```

**ZIP'ten** (`MIR_MOTORS_BURAK_TESLIM.zip`): ZIP'i aç, `mirmotors` klasörüne gir. Git geçmişi ZIP içindeki
`mirmotors-git-gecmisi.bundle` dosyasındadır. Geçmişle çalışmak istersen ZIP'i açtığın yerde:

```bash
git clone -b vercel-deploy mirmotors-git-gecmisi.bundle mirmotors-git
```

## 2. Bağımlılıkları kur

```bash
npm ci
```

## 3. Yerel veritabanını oluştur

**Seçenek A — `prisma dev` (önerilen, kurulum yok):**

```bash
npx prisma dev --name mirmotors --detach
```

Komut `TCP:` satırında `postgres://postgres:postgres@localhost:<port>/template1?sslmode=disable` gibi bir adres yazar.
Durumu görmek için `npx prisma dev ls`, durdurmak için `npx prisma dev stop mirmotors`.

**Seçenek B — Docker:**

```bash
docker run -d --name mirmotors-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mirmotors -p 5432:5432 postgres:16
```

Adres: `postgres://postgres:postgres@localhost:5432/mirmotors`

**`.env` dosyasını oluştur:**

```bash
node scripts/ensure-env.mjs
```

Bu, `.env.example`'dan `.env` oluşturur ve rastgele bir `SESSION_SECRET` üretir. Ardından `.env` içinde
`DATABASE_URL` ve `DATABASE_URL_UNPOOLED` satırlarını kendi adresinle değiştir (ikisi aynı olabilir):

- Seçenek A'da adresin sonuna **`&connection_limit=1&pgbouncer=true`** ekle (yoksa "prepared statement already exists" hatası alırsın).
- Seçenek B'de adresi olduğu gibi kullan.

`BLOB_READ_WRITE_TOKEN` yerelde **boş kalmalı**; boşsa yüklenen dosyalar `storage/` klasörüne yazılır.

## 4. Tabloları oluştur ve örnek verileri yükle

```bash
npm run setup
```

Prisma istemcisini üretir, migration'ları uygular ve örnek veriyi yükler: 3 personel + 11 temsilî araç
(8 satışta, 1 opsiyonlu, 1 satış bekleyen, 1 satılmış, 1 taslak). **Veritabanında önceden veri varsa siler.**

## 5. Çalıştır

Geliştirme modu (kod değiştikçe yenilenir, veriyi silmez):

```bash
npm run dev
```

Üretim derlemesiyle (sunum gibi):

```bash
npm run build
```

```bash
npm start
```

- Site: http://localhost:3000
- CRM: http://localhost:3000/crm

> `npm run demo` = setup + build + start. **Her seferinde veriyi sıfırlar.** Sunumdan hemen önce temiz başlangıç için kullan, geliştirirken kullanma.

## 6. CRM'e giriş (yerel)

| Hesap | E-posta | Rol |
|---|---|---|
| Yönetici | `yonetici@mirmotors.demo` | Yönetici (her işlem) |
| Ahmet | `ahmet@mirmotors.demo` | Satış personeli |
| Mehmet | `mehmet@mirmotors.demo` | Satış personeli |

Yerel demo şifresi `prisma/seed.ts` içindeki `LOCAL_DEMO_PASSWORD` değeridir (yalnızca yerel örnek veri içindir; canlı ortamda geçersizdir).
Yerelde HTTP Basic erişim kapısı yoktur (`DEMO_ACCESS_PASSWORD` boş).

Aynı tarayıcı profilinde tek oturum açılır; Ahmet ve Mehmet'i aynı anda denemek için ayrı tarayıcı profili veya gizli pencere kullan.
Adım adım demo akışı: `DEMO_SCRIPT.md`.

## 7. Testleri çalıştır

**Lint ve derleme:**

```bash
npm run lint
```

```bash
npm run build
```

**Birim testleri** (durum makinesi, eşzamanlılık). Ayrı bir yerel test veritabanı ister; testler bu veritabanını boşaltır:

```bash
npx prisma dev --name mirmotors-test --detach
```

macOS / Linux / Git Bash:

```bash
TEST_DATABASE_URL="<test adresi>&connection_limit=1&pgbouncer=true" npm test
```

Windows PowerShell:

```powershell
$env:TEST_DATABASE_URL="<test adresi>&connection_limit=1&pgbouncer=true"; npm test
```

`TEST_DATABASE_URL` localhost değilse testler başlamaz.

**Uçtan uca (E2E) senaryo:** sunucu çalışırken (`npm run build` + `npm start`) ikinci bir terminalde:

```bash
npm run e2e
```

E2E veritabanına test aracı ekler; bitince `npm run db:reset` ile temizle.

## 8. Geliştirmeye devam ederken

**Hangi klasör?**

| Ne yapacaksın | Nerede |
|---|---|
| Müşteri sitesi sayfası | `src/app/(site)/` + bileşenler `src/components/site/` |
| CRM sayfası | `src/app/crm/(panel)/` + bileşenler `src/components/crm/` |
| API | `src/app/api/crm/...` (her rotada `requireApiUser()` kullan) |
| İş kuralı (durum, yetki) | `src/lib/vehicle-status.ts`, `src/lib/permissions.ts` — değiştirirsen `tests/vehicle-status.test.ts`'e test ekle |
| Veri modeli | `prisma/schema.prisma` → `npx prisma migrate dev --name <ad>` (yalnızca yerel veritabanında) → oluşan `prisma/migrations/...` klasörünü commit et |
| Dosya yükleme | `src/lib/storage.ts` (yerel + Blob), `src/lib/direct-upload.ts` |
| AI | `src/lib/ai/` |
| Örnek veri | `prisma/seed.ts` |

**Claude Code ile:** proje kökündeki `CLAUDE.md` kuralları ve önemli dosyaları özetler; Claude Code klasörü açınca okur.

**Önerilen Git akışı:** `vercel-deploy` dalından yeni bir dal aç (`git switch -c ozellik/<ad>`), değişikliği test et, sonra birleştir.

## 9. Vercel sürümünü yanlışlıkla bozmamak için

1. **Canlı veritabanı adresini yerelde kullanma.** `vercel env pull` komutu canlı Neon adresini `.env.local`'e yazar; o klasörde
   `npm run dev` canlı veriyi değiştirir, E2E canlıya test aracı ekler. Gerekirse ayrı bir klasörde ve dikkatle kullan.
2. **Neon üzerinde `prisma migrate reset`, `prisma db push --force-reset` veya elle `TRUNCATE` çalıştırma.**
   Şema değişikliği her zaman yerelde `prisma migrate dev` ile migration olarak üretilir; canlıya deploy sırasında `prisma migrate deploy` uygular.
   Veri silen (kolon/tablo kaldıran) migration'ları canlıya göndermeden önce gözden geçir.
3. **Bulut seed'i** yalnızca `npm run db:seed:cloud` ile ve yalnızca boş veritabanına çalışır; elle yazılmış sıfırlama betiği kullanma.
4. **Önizleme (preview) deploy'ları da canlıyla aynı veritabanını kullanır.** Önizlemede yapılan araç/satış işlemleri canlı veride görünür.
5. **Deploy etmeden önce** yerelde `npm run lint`, `npm run build`, birim testleri ve E2E'yi çalıştır.
6. Vercel ortam değişkenini değiştirdikten sonra yeniden deploy gerekir. `DEMO_ACCESS_PASSWORD`'ı silme — silinirse CRM kapanır (503), bu bilinçli bir korumadır.
7. **`.env*` dosyalarını, şifreleri, `storage/` klasörünü commit etme** (`.gitignore` bunları dışarıda tutar). Depoyu herkese açık yapma.
8. Video sınırı Vercel'de 50 MB'tır (Blob ücretsiz kotası). Ücretli Vercel/Neon planı açmadan önce proje sahibiyle konuş.
9. Deploy yetkisi için proje sahibinin seni Vercel ekibine eklemesi gerekir; deploy komutu: `vercel deploy --prod` (proje klasöründe, `vercel link` sonrası).
