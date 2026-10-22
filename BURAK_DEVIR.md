# Mir Motors — Teknik Devir Dokümanı (Burak için)

Projeyi ilk kez gördüğün varsayılarak yazıldı. Kurulum adımları: `BURAK_KURULUM.md`. Kararların geçmişi: `PROJECT_HISTORY.md`.

## 1. Projenin amacı

Mir Motors ikinci el araç galerisi için tek bir Next.js uygulaması:

- **Müşteri sitesi** (`/`): Borz Motor tarzı araç listeleme, filtreleme, araç detayı, story şeridi, hero slider.
- **CRM** (`/crm`): personelin araç ekleme, fotoğraf/video/PDF yükleme, yayımlama, opsiyon ve satış işlemleri.

Durum: **demo/prototip**. Araçlar ve görseller temsilidir; üretim sistemi değildir.

## 2. Dallar ve teslimat temeli

| Dal | Veritabanı | Dosyalar | Kullanım |
|---|---|---|---|
| **`vercel-deploy`** (teslimat temeli) | PostgreSQL (Neon / yerelde `prisma dev`) | Vercel Blob (yerelde `storage/`) | Canlı demo bu dalda; geliştirmeye buradan devam et. |
| `master` | SQLite (`prisma/dev.db`) | `storage/` | İlk yerel demo; kurulum gerektirmez. `vercel-deploy` bu dalın tüm commit'lerini içerir. |

`master`'da olup `vercel-deploy`'da olmayan commit yoktur (kontrol edildi).

## 3. Teknolojiler

Next.js 15.5 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Prisma 6 · PostgreSQL (Neon) · Vercel Blob (`@vercel/blob`) ·
jose (JWT oturum) · bcryptjs · zod 4 · Vitest · `@anthropic-ai/sdk` (yalnızca canlı AI yolu, şu an kullanılmıyor) · Node.js 24 ile test edildi.

## 4. Klasör yapısı

```
prisma/
  schema.prisma          Veri modeli (PostgreSQL)
  migrations/            Migration dosyaları (deploy'da `prisma migrate deploy`)
  seed.ts                Örnek veri (yerel sıfırlama / bulut ilk yükleme)
public/demo-cars/        Demo araç fotoğrafları + CREDITS.md (Unsplash License)
scripts/                 ensure-env, guard-local-db (sıfırlama koruması), db-url
src/
  middleware.ts          CRM erişim kapısı (HTTP Basic) + oturum kontrolü
  app/(site)/            Müşteri sitesi: ana sayfa, /araclar, /araclar/[id], /hakkimizda, /iletisim
  app/crm/               CRM sayfaları: /crm/login, /crm (özet), /crm/vehicles, /crm/vehicles/new/(manual|ai), /crm/vehicles/[id]
  app/api/               API rotaları (aşağıda)
  app/media/[...path]    Herkese açık medya servisi (Range destekli)
  components/site/       Site bileşenleri (VehicleCard, FilterPanel, StoryBar, HeroSlider, HeroSearch…)
  components/crm/        CRM bileşenleri (VehicleForm, MediaManager, StatusActions…)
  lib/                   İş mantığı (aşağıda)
tests/
  vehicle-status.test.ts Durum makinesi birim testleri (eşzamanlılık dahil)
  e2e-demo.mjs           Çalışan sunucuya karşı uçtan uca senaryo
  fixtures/              Test dosyaları
demo-assets/             Sunum için örnek BMW fotoğrafları, yedek sunum ekranları/videosu
```

Önemli `src/lib` dosyaları:

| Dosya | Görev |
|---|---|
| `vehicle-status.ts` | Durum makinesi; tüm geçişler koşullu/atomik |
| `permissions.ts` | Opsiyon sahipliğine göre düzenleme/medya yetkisi |
| `auth.ts`, `session.ts` | Oturum (imzalı çerez), `requireUser` / `requireApiUser` |
| `storage.ts` | Dosya depolama (yerel / Blob), dosya imzası doğrulama |
| `direct-upload.ts` | Tarayıcıdan Blob'a doğrudan yükleme |
| `public-vehicles.ts` | Müşteri sitesi sorguları ve filtreler |
| `home-stories.ts` | Story içeriği (yayındaki araçlardan) |
| `vehicle-schema.ts` | Araç formu doğrulaması (zod) |
| `ai/vehicle-draft.ts`, `ai/simulation.ts`, `ai/frames.ts` | AI taslağı (canlı yol doğrulanmadı) ve simülasyon |
| `constants.ts` | Durumlar, roller, yükleme sınırları, seçenek listeleri |

## 5. Veritabanı modeli (`prisma/schema.prisma`)

| Model | Alanlar (özet) |
|---|---|
| `User` | ad, e-posta (benzersiz), bcrypt şifre özeti, `role` (ADMIN / SALES), giriş deneme sayacı |
| `Vehicle` | durum, marka/model/paket/yıl/km/fiyat (TL), yakıt/vites/kasa/renk/güç/çekiş, donanım (JSON), boya/değişen/hasar/tramer, ekspertiz özeti, `expertisePdfPath`, `videoPath` (benzersiz), yasal alanlar (`legalListingNo`, `legalAuthorizationNo`, `legalPlate`, `legalVin`, `legalOwnerConsent`), AI izi (`aiDraftMode`, `aiDraftJson`), opsiyon sahibi/zamanı, oluşturan, yayın/satış tarihleri |
| `VehiclePhoto` | araç, yol, kapak mı, sıra |
| `StatusHistory` | araç, önceki/sonraki durum, işlem, personel, not, tarih |
| `Sale` | araç, başlatan, anlaşılan fiyat, noter onayı ve tarihi, tamamlayan, iptal tarihi |

Durumlar ve roller enum değil `String`; geçerli değerler `src/lib/constants.ts` + zod ile sunucuda denetlenir.
Müşteri (lead) modeli **yoktur**.

## 6. API yapısı

Tüm `/api/crm/*` rotaları oturum ister (middleware + her rotada `requireApiUser()`).

| Yöntem ve yol | Görev |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout` | Personel girişi/çıkışı |
| `POST /api/crm/vehicles` | Yeni araç (her zaman taslak) |
| `PATCH /api/crm/vehicles/[id]` | Araç bilgilerini düzenle |
| `POST /api/crm/vehicles/[id]/transition` | Durum geçişi: `publish`, `unpublish`, `option`, `releaseOption`, `startSale`, `completeSale`, `cancelSale` |
| `POST /api/crm/vehicles/[id]/photos` · `PATCH/DELETE .../photos/[photoId]` | Fotoğraf ekle · kapak yap / sil |
| `POST/DELETE /api/crm/vehicles/[id]/video` | Video ekle/sil |
| `POST/DELETE /api/crm/vehicles/[id]/expertise` | Ekspertiz PDF'i ekle/sil |
| `POST /api/crm/uploads` | Vercel Blob doğrudan yükleme jetonu (yalnızca Blob ortamında) |
| `POST /api/crm/ai-draft` | AI taslağı (Vercel'de her zaman simülasyon) |
| `GET /api/crm/files/[...path]` | Ekspertiz PDF'i (yalnızca oturumlu personel) |
| `GET /media/[...path]` | Fotoğraf/video (herkese açık, Range destekli) |

## 7. CRM yetkilendirme

1. **Erişim kapısı (yalnızca internette):** `DEMO_ACCESS_PASSWORD` tanımlıysa `/crm`, `/api/crm`, `/api/auth` önce HTTP Basic şifresi ister.
   Vercel'de bu değişken yoksa CRM hiç açılmaz (503). Müşteri sitesi açıktır (`DEMO_ACCESS_SCOPE=all` ile o da kapanır).
2. **Personel girişi:** e-posta + şifre → imzalı httpOnly çerez (12 saat). Vercel'de çerez otomatik `Secure`.
3. **Roller:** `ADMIN` (Yönetici) ve `SALES` (Satış Personeli). Demo hesapları: `yonetici@`, `ahmet@`, `mehmet@mirmotors.demo`.
4. **Kurallar** (`permissions.ts`, `vehicle-status.ts`): opsiyonlu araçta bilgi/medya değişikliğini yalnızca opsiyon sahibi veya yönetici yapar;
   satış bekleyen/satılmış araç düzenlenemez; yayından alma ve satış iptali yalnızca yönetici.
5. **Giriş deneme sınırı:** hesap başına 15 dakikada 10 hatalı deneme (sayaç veritabanında).

## 8. Araç durum makinesi

```
DRAFT ──yayımla (≥1 fotoğraf)──▶ AVAILABLE ──opsiyonla──▶ OPTIONED ──satış başlat──▶ SALE_PENDING ──noter onayı──▶ SOLD
  ▲                                │  ▲                      │                          │
  └──── yayından al (yönetici) ────┘  └── opsiyon kaldır ────┘                          └── satış iptali (yönetici) → AVAILABLE
```

| Durum | Müşteri sitesinde |
|---|---|
| DRAFT | Görünmez |
| AVAILABLE | Görünür |
| OPTIONED | Görünür, "Opsiyonlu" etiketiyle |
| SALE_PENDING | Görünmez, eski bağlantı 404 |
| SOLD | Görünmez, eski bağlantı 404; CRM'de satış kaydı ve işlem geçmişi korunur |

Her geçiş tek işlemde `UPDATE ... WHERE id=? AND status=? [AND optionedById=?]` ile yapılır; aynı anda gelen iki istekten
yalnızca biri başarılı olur. Ayrıntılı tablo: `DECISIONS.md` → "Opsiyon ve satış kuralları".

## 9. Medya yükleme

| Ortam | Nasıl çalışır |
|---|---|
| Yerel (`BLOB_READ_WRITE_TOKEN` yok) | Form verisiyle sunucuya; `storage/public` (fotoğraf/video), `storage/private` (PDF) |
| Vercel (`BLOB_READ_WRITE_TOKEN` var) | Tarayıcı `/api/crm/uploads`'tan kısa ömürlü jeton alır → dosyayı **özel** Blob mağazasına doğrudan yükler → ilgili API rotası boyutu ve dosya imzasını doğrulayıp kaydı oluşturur (uymayan dosya silinir) |

- Sınırlar: fotoğraf 10 MB (JPG/PNG/WEBP), video **yerelde 200 MB / Vercel'de 50 MB** (MP4/WEBM/MOV), PDF 15 MB.
- Seed fotoğrafları `public/demo-cars/` içinden statik servis edilir (yol `/demo-cars/...`), Blob kotası kullanmaz.
- Fotoğraf/video `/media/<araç>/<uuid>.<uzantı>` üzerinden herkese açık; PDF yalnızca `/api/crm/files/...` üzerinden personele.
- Görsel yeniden boyutlandırma ve video dönüştürme **yok**.

## 10. Vercel dağıtımı

- Proje: `mirmotors-demo` (Vercel Hobby, ekip `trappigs-projects`), bölge `fra1`. Adres: https://mirmotors-demo.vercel.app
- Veritabanı: Neon Free (`mirmotors-db`, fra1, Vercel Marketplace). Dosyalar: Vercel Blob özel mağaza (`mirmotors-media`, fra1).
- Build: `npm run vercel-build` = `prisma generate && prisma migrate deploy && next build` (`vercel.json`). Seed çalıştırmaz, veri silmez.
- Yayın: proje klasöründen `vercel deploy --prod` (şu an GitHub otomatik dağıtımı bağlı değil).
- Ayrıntı ve adımlar: `VERCEL_DEPLOY.md`.
- Vercel hesabı proje sahibine aittir; Burak'ın erişimi için proje sahibinin onu Vercel ekibine eklemesi gerekir.

## 11. Ortam değişkenleri (yalnızca adlar)

| Ad | Nerede | Not |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Yerel + Vercel | Neon entegrasyonu Vercel'e otomatik ekler |
| `SESSION_SECRET` | Yerel + Vercel | Oturum imzalama anahtarı |
| `DEMO_ACCESS_USER`, `DEMO_ACCESS_PASSWORD`, `DEMO_ACCESS_SCOPE` | Vercel | CRM erişim kapısı |
| `DEMO_STAFF_PASSWORD` | Yalnızca bulut seed'ini çalıştırırken | Bulut personel şifresi |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Blob mağazası bağlanınca otomatik |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `FFMPEG_PATH` | İsteğe bağlı | Canlı AI (doğrulanmadı) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_INSTAGRAM_URL` | İsteğe bağlı | Site bağlantıları (demo numarası gerçek değil) |
| `STORAGE_DIR`, `COOKIE_SECURE`, `TEST_DATABASE_URL` | Yerel | Yerel depolama, HTTPS çerezi, test veritabanı |

Gerçek değerler bu depoda **yoktur**. Canlı ortamın şifreleri proje sahibinde (`.env.vercel-secrets.local`, git dışı).

## 12. Komutlar

| Komut | Görev | Dikkat |
|---|---|---|
| `npm run setup` | `.env` oluştur, Prisma istemcisi, migration, **örnek veriyi baştan yükle** | Veriyi siler; yalnızca localhost |
| `npm run demo` | setup + build + start | **Veriyi siler**; yalnızca localhost |
| `npm run db:reset` | Örnek veriyi baştan yükle | **Veriyi siler**; yalnızca localhost |
| `npm run db:seed:cloud` | Bulut veritabanına ilk yükleme | Hiçbir şey silmez; veri varsa hiçbir şey yapmaz |
| `npm run dev` / `npm run build` / `npm start` | Geliştirme / derleme / derlenmişi çalıştır | `npm start` veriyi korur |
| `npm run lint` | ESLint | |
| `npm test` | Birim testleri (`TEST_DATABASE_URL` yerel PostgreSQL ister) | Test veritabanını boşaltır |
| `npm run e2e` | Uçtan uca senaryo (çalışan sunucuya karşı) | Test aracı ekler |

## 13. Özelliklerin mevcut durumu

Durumlar koddan ve testlerden doğrulandı (son test: 22.10.2026, canlı adres dahil).

| Modül | Durum | Açıklama |
|---|---|---|
| Web sitesi | **Çalışıyor** | Ana sayfa, Araçlarımız, detay, Hakkımızda, İletişim; mobil uyumlu; DEMO bandı, noindex. Hakkımızda/İletişim metinleri temsilî. |
| Araç listeleme | **Çalışıyor** | Izgara/liste, sıralama, Opsiyonlu etiketi; satış bekleyen/satılan gizli. |
| Filtreleme | **Çalışıyor** | Metin araması (büyük/küçük harf duyarsız), fiyat/yıl/km/yakıt/vites/kasa/marka-model, hızlı etiketler. Renk, donanım, boya/değişen filtreleri **yapılmadı**. |
| Araç detayları | **Çalışıyor** | Galeri, video, özellikler, donanım, boya/değişen/hasar, ekspertiz özeti, WhatsApp bağlantısı. |
| Story | **Çalışıyor** | Yayındaki araçlardan üretilir; Instagram API yok, Instagram bağlantısı tanımlı değil ("yakında"). |
| Hero Slider | **Çalışıyor** | 3 slayt, otomatik geçiş, erişilebilirlik; görseller temsilî (Unsplash). |
| CRM | **Çalışıyor** | Özet, araç listesi, araç sayfası, işlem geçmişi, satış kayıtları. |
| Manuel araç ekleme | **Çalışıyor** | Taslak olarak oluşur, yayımlama ayrı adım. |
| Fotoğraf/video/PDF yükleme | **Çalışıyor** (sınırlarla) | Canlıda arayüzle 3 fotoğraf, E2E ile video ve PDF doğrulandı. Vercel'de video 50 MB; yeniden boyutlandırma/dönüştürme yok. |
| Personel yetkileri | **Kısmen tamamlandı** | 2 rol ve kurallar çalışıyor; kullanıcı ekleme/silme, şifre değiştirme ekranı **yok** (3 sabit demo hesabı). |
| Opsiyon yönetimi | **Çalışıyor** | Opsiyonla/kaldır, sahiplik kuralları, eşzamanlılık. Otomatik opsiyon süresi **yok**. |
| Satış yönetimi | **Çalışıyor** | Satış başlat, noter onayıyla tamamla, yönetici iptali, geçmiş korunur. Ödeme/kapora yok (bilinçli). |
| AI video analizi | **Simülasyon** | Arayüz ve simülasyon çalışıyor; canlı Claude + Whisper yolu gerçek anahtarlarla **test edilmedi**; Vercel'de kapalı. |
| Müşteri CRM'i (lead/müşteri kaydı) | **Henüz yapılmadı** | Veri modeli ve ekran yok. |
| WhatsApp | **Kısmen tamamlandı** | Yalnızca `wa.me` bağlantısı (demo numarası). Stok botu **yapılmadı**. |
| Instagram DM | **Henüz yapılmadı** | |
| EİDS | **Hukuki inceleme gerekiyor** | Gereklilik netleşmedi; entegrasyon yok. |
| İlan zorunlu bilgileri, KVKK, şirket bilgileri | **Hukuki inceleme gerekiyor** | Yasal alanlar veri modelinde var, sitede gösterim kuralı belirlenmedi. |
| Üretim ortamı güvenliği | **Kısmen tamamlandı** | Demo düzeyi: erişim kapısı, imzalı çerez, deneme sınırı, dosya doğrulama, PDF yetkisi. Eksik: kullanıcı yönetimi, CSRF jetonu, yedekleme politikası, virüs taraması, denetim kaydı koruması, sızma testi. |

## 14. Bilinen hatalar ve sınırlamalar

- `npm run demo` / `setup` / `db:reset` **örnek veriyi baştan yükler** (yalnızca localhost'ta çalışır, bulutta durur).
- `vercel env pull` ile oluşan `.env.local` **canlı Neon veritabanını** gösterir; o klasörde `npm run dev` canlı veriyi değiştirir (bkz. `BURAK_KURULUM.md`).
- Önizleme (preview) deploy'ları da canlı ile **aynı veritabanını** kullanır.
- Canlı veritabanında testlerden kalan iki **satılmış** BMW kaydı var ("520i M Sport E2E" ve bir "520i M Sport"); sitede görünmez, CRM geçmişinde durur.
- Medya yükleme: yetki kontrolü ile kayıt ayrı adımlar (çok kısa yarış penceresi). Yüklenip kaydı tamamlanmayan Blob dosyaları (sekme kapanması, kullanılmayan AI taslak videosu) otomatik temizlenmez.
- Görseller yeniden boyutlandırılmaz; `.mov` (HEVC) bazı tarayıcılarda oynamayabilir.
- Aynı tarayıcı profilinde tek oturum; HTTP Basic erişim şifresi tarayıcı kapanana kadar hatırlanır (CRM çıkışı onu silmez).
- Yerelde `npx prisma dev` (PGlite) bağlantı adresine `connection_limit=1&pgbouncer=true` eklenmezse "prepared statement already exists" hatası verir.
- Prisma CLI, AI ajanlarının `prisma migrate reset` çalıştırmasını kullanıcı onayı olmadan engeller; test kurulumu bu yüzden tabloları boşaltma yöntemini kullanır.
- Temiz derlemede "Compiled with warnings" uyarısı: `jose` kütüphanesinin JWE sıkıştırma kodu (CompressionStream) Edge runtime'da desteklenmiyor.
  Uygulama yalnızca JWS imzası kullanır, bu kod hiç çalışmaz; zararsızdır (ilk sürümde de vardı).
- Vercel **Hobby** planı kişisel/ticari olmayan kullanım içindir; gerçek ticari yayında Pro gerekir.
- Neon Free kullanılmadığında uyur; ilk istek kısa gecikebilir.

## 15. Son Git commit'leri (`vercel-deploy`)

```
c96062e Canlı Vercel dağıtımı: erişim kapısı testi düzeltildi, canlı sonuçlar belgelendi
fbcb14b Vercel: fra1 bölgesi, doğrudan yükleme reddinde anlaşılır hata mesajı
433686e Vercel ücretsiz demo dağıtımı için hazırlık (Neon Postgres + Vercel Blob)
787c9ed WIP: Postgres şeması ve ilk migration
e026912 Ana sayfaya story şeridi ve hero slider eklendi
ab9751c Demo araç görselleri gerçek fotoğraflarla değiştirildi (Unsplash License)
ecaed54 Müşteri sitesi kırmızı-beyaz-siyah tasarım sistemine geçirildi (Borz Motor referansı)
2422ac1 Araç listeleme ve ana sayfa Borz Motor düzenine uyarlandı
```

Tam liste: `git log --oneline`. Bu dokümanları ekleyen devir commit'i bunların üstündedir.

## 16. Bağlantılar

- Canlı demo: https://mirmotors-demo.vercel.app (CRM: `/crm`, erişim ve personel şifreleri proje sahibinden alınır)
- Miro akış diyagramı: https://miro.com/app/board/uXjVEXcXXrM=/
- Diğer belgeler: `README.md`, `BURAK_KURULUM.md`, `PROJECT_HISTORY.md`, `ROADMAP_BURAK.md`, `DECISIONS.md`, `STATUS.md`, `VERCEL_DEPLOY.md`, `DEMO_SCRIPT.md`, `CLAUDE.md`
