# Mir Motors — Ücretsiz Vercel Demo Dağıtımı

Bu dal (`vercel-deploy`), çalışan yerel demoyu (`master`, SQLite) bozmadan müşteri sitesini ve CRM'i
tek bir `*.vercel.app` adresinden çalıştırmak için hazırlandı. Yalnızca ücretsiz katmanlar kullanılır.

## Ücretsiz servisler

| Servis | Kullanım | Ücretsiz katman notu |
|---|---|---|
| Vercel Hobby | Next.js uygulaması (site + CRM + API) | Hobby planı kişisel/ticari olmayan kullanım içindir; gerçek ticari yayın için Pro gerekir. |
| Neon Free (Vercel Marketplace) | PostgreSQL veritabanı (araçlar, personel, satış kayıtları) | Kullanılmadığında uyur, ilk istek ~1 sn gecikebilir. |
| Vercel Blob (Hobby kotası) | CRM'den yüklenen fotoğraf, video, ekspertiz PDF'i | Özel (private) mağaza. Kota aşılırsa yükleme durur, ücret çıkmaz. |

Seed (örnek stok) fotoğrafları `public/demo-cars/` içinden **statik dosya** olarak servis edilir; Blob kotası kullanmaz.

## Yerel sürümden farklar

- **Veritabanı:** SQLite → PostgreSQL (`prisma/migrations`). Tablolar `prisma migrate deploy` ile oluşturulur; deploy hiçbir veriyi silmez.
- **Dosyalar:** Vercel'in diski kalıcı değildir ve istek gövdesi 4,5 MB ile sınırlıdır. `BLOB_READ_WRITE_TOKEN` tanımlıysa dosyalar tarayıcıdan
  **doğrudan** Blob'a yüklenir (`/api/crm/uploads` kısa ömürlü, tür/boyut kısıtlı jeton verir); sunucu ardından boyutu ve dosya imzasını
  doğrulayıp kaydı oluşturur, uymayan dosyayı siler.
  - Fotoğraf/video: `/media/...` rotasından herkese açık (video ileri-geri sarma için Range destekli).
  - Ekspertiz PDF'i: yalnızca oturumlu personel, `/api/crm/files/...` (oturumsuz istek 401).
- **Video sınırı:** Vercel'de en fazla **50 MB** (ücretsiz Blob kotasını korumak için; yerelde 200 MB). Araç ve satış akışı videoya bağlı değildir.
- **AI ile video girişi:** Vercel'de her zaman **Simülasyon Modu** (canlı AI kapalı).
- **Giriş deneme sınırı:** bellek yerine veritabanında (sunucusuz ortamda tüm örnekler aynı sayacı görür).
- **Arama:** büyük/küçük harf duyarsız (`mode: "insensitive"`).

## Erişim kontrolü

1. **CRM erişim kapısı (HTTP Basic):** `/crm` ve CRM API'leri önce `DEMO_ACCESS_USER` / `DEMO_ACCESS_PASSWORD` ister.
   Vercel'de `DEMO_ACCESS_PASSWORD` tanımlı değilse CRM **açılmaz** (503) — yanlışlıkla korumasız yayın olmaz.
   Müşteri sitesi açıktır; `DEMO_ACCESS_SCOPE=all` ile o da korunur.
2. **Personel girişi:** Yönetici, Ahmet, Mehmet. Bulutta şifre `DEMO_STAFF_PASSWORD`'dan gelir; yerel demo şifresi (`MirDemo2026!`) bulutta kullanılamaz.
3. Oturum çerezi Vercel'de otomatik `Secure` + `HttpOnly`.
4. `noindex` başlığı, meta etiketi, `robots.txt` ve DEMO bandı korunur.

## Sıfırlama koruması

| Komut | Davranış |
|---|---|
| `npm run demo`, `npm run setup`, `npm run db:reset` | `DATABASE_URL` **localhost değilse durur** (tüm veriyi silen komutlar). |
| `npm run db:seed:cloud` | Hiçbir şey silmez; veritabanında kullanıcı varsa hiçbir şey yapmaz. |
| Vercel build (`npm run vercel-build`) | `prisma generate` + `prisma migrate deploy` + `next build`. Seed çalıştırmaz, veri silmez. |

## Ortam değişkenleri (Vercel → Project → Settings → Environment Variables)

| Değişken | Zorunlu | Not |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Evet | Neon entegrasyonu otomatik ekler. |
| `SESSION_SECRET` | Evet | En az 32 karakter rastgele değer. |
| `DEMO_ACCESS_PASSWORD` | Evet | CRM erişim kapısı şifresi. |
| `DEMO_ACCESS_USER` | Hayır | Varsayılan `mirmotors`. |
| `BLOB_READ_WRITE_TOKEN` | Yükleme için evet | Blob mağazası bağlanınca eklenir; yoksa mağaza ayarlarından okuma-yazma anahtarı eklenir. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_INSTAGRAM_URL` | Hayır | |
| `DEMO_STAFF_PASSWORD` | Yalnızca seed sırasında | Vercel'e eklenmesi gerekmez; seed komutunu çalıştıran bilgisayarda verilir. |

## Kurulum adımları

Tüm komutlar bu dalın klasöründe (`mirmotors-demo-vercel`) çalıştırılır.

1. **Vercel projesine bağla:** `vercel link` (Hobby hesabı, yeni proje: `mirmotors-demo`).
2. **Neon Free veritabanı:** Vercel panelinde Storage → Create → Neon (Free) → projeye bağla.
   (CLI: `vercel integration add neon` — Neon şartlarının kabulü kullanıcıya aittir.)
3. **Blob mağazası (özel):** `vercel blob create-store mirmotors-media --access private` ve projeye bağla.
4. **Ortam değişkenleri:** `SESSION_SECRET`, `DEMO_ACCESS_PASSWORD` (ve isteğe bağlı diğerleri) Production ortamına eklenir.
5. **İlk veri (bir kez):** `vercel env pull .env.vercel.local` → değişkenleri yükleyip
   `DEMO_STAFF_PASSWORD=... npm run db:seed:cloud` (tabloları oluşturur, boş veritabanına 3 personel + 11 örnek araç yükler).
6. **Yayın:** `vercel deploy --prod`. GitHub bağlantısı gerekmez.
7. **Canlı test:** `E2E_ACCESS=kullanıcı:şifre E2E_PASSWORD=... E2E_DIRECT=1 node tests/e2e-demo.mjs https://<proje>.vercel.app`
   (Test bir "520i M Sport E2E" aracı oluşturup satar; kayıt CRM satış geçmişinde kalır.)

## Yerel geliştirme

- Yerel demo: `master` dalı (SQLite), `npm run demo` — değişmedi.
- Bu dal yerelde: `npx prisma dev` ile yerel PostgreSQL açılır, `.env` içine localhost adresi yazılır, `npm run demo`.
  Birim testleri ayrı bir yerel veritabanı ister: `TEST_DATABASE_URL=<localhost adresi> npm test`.

## Bilinen sınırlar

- Önizleme (preview) deploy'ları da aynı veritabanını kullanır (Neon entegrasyonunda önizleme dalları ayrıca açılabilir).
- Fotoğraf/video Blob'dan uygulama üzerinden akıtılır (CDN önbellekli); yüksek trafikte bant genişliği kotası dolabilir — demo için yeterli.
- Neon Free uyku modundan ilk uyanışta kısa gecikme olabilir.

## Canlı dağıtım (2026-10-22)

- Adres: **https://mirmotors-demo.vercel.app** (Vercel Hobby, proje `mirmotors-demo`, bölge fra1)
- Veritabanı: Neon Free (`mirmotors-db`, fra1) · Dosyalar: Vercel Blob özel mağaza (`mirmotors-media`, fra1)
- Gizli değerler (erişim ve personel şifreleri): `.env.vercel-secrets.local` (git dışında)
- Canlı testler: HTTP E2E 66/67 geçti (tek hata testin kendisindeydi: ana sayfanın da kilitli olmasını bekliyordu; düzeltildi,
  site açık / CRM 401 ayrıca doğrulandı). Gerçek tarayıcıyla tam demo akışı: Blob'a 3 fotoğraf yükleme, yayın, story ve arama,
  filtre, opsiyon, Mehmet engeli, noter onaylı satış, listeden/story'den kalkma, eski bağlantı 404, mobilde taşma yok, konsol hatası yok.
- Testlerden kalan kayıtlar: "520i M Sport E2E" ve bir "BMW 5 Serisi 520i M Sport" — ikisi de **satıldı** durumunda;
  müşteri sitesinde görünmez, CRM satış geçmişinde durur.
