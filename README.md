# Mir Motors — Galeri Sitesi + CRM (DEMO)

Mir Motors için kurumsal araç satış web sitesi ve galeri CRM'i demosu. Müşteri sitesi (`/`) ile personel paneli (`/crm`) aynı Next.js uygulamasındadır;
araç ekleme → fotoğraf yükleme → yayımlama → opsiyon → noter onaylı satış → ilanın kaldırılması zinciri veritabanı üzerinde gerçekten çalışır.

> Bu bir demo sürümüdür. Araçlar, fiyatlar ve görseller temsilidir. Üretim ortamı güvenlik sertifikası veya hukuki uyumluluk garantisi verilmez.
> AI ile video girişi **Simülasyon Modu**'ndadır; canlı AI analizi doğrulanmamıştır.

- **Canlı demo:** https://mirmotors-demo.vercel.app (CRM ek erişim şifresi ister)
- **Bu dal:** `vercel-deploy` — PostgreSQL (Neon) + Vercel Blob. İlk yerel SQLite sürümü `master` dalındadır.

## Belgeler

| Belge | İçerik |
|---|---|
| [BURAK_KURULUM.md](BURAK_KURULUM.md) | **Adım adım kurulum**, çalıştırma, testler, güvenli geliştirme |
| [BURAK_DEVIR.md](BURAK_DEVIR.md) | Teknik devir: mimari, veri modeli, API, yetki, durum makinesi, özellik durum tablosu, bilinen hatalar |
| [PROJECT_HISTORY.md](PROJECT_HISTORY.md) | Proje geçmişi ve alınan kararların özeti |
| [ROADMAP_BURAK.md](ROADMAP_BURAK.md) | Geliştirme yol haritası |
| [DECISIONS.md](DECISIONS.md) | Teknik kararlar ve gerekçeleri |
| [STATUS.md](STATUS.md) | Durum raporu ve kabul testleri |
| [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) | Vercel dağıtımı, ortam değişkenleri, ücretsiz servisler |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md) | Sunum akışı |
| [CLAUDE.md](CLAUDE.md) | Claude Code ile geliştirme kuralları |

## Hızlı başlangıç (yerel)

Gereksinim: Node.js 20+ ve yerel PostgreSQL (`npx prisma dev` veya Docker). Ayrıntı: [BURAK_KURULUM.md](BURAK_KURULUM.md).

```bash
npm ci
```

```bash
npx prisma dev --name mirmotors --detach
```

```bash
node scripts/ensure-env.mjs
```

`.env` içindeki `DATABASE_URL` / `DATABASE_URL_UNPOOLED` değerlerini yerel adresle güncelleyin, sonra:

```bash
npm run setup
```

```bash
npm run dev
```

Site: http://localhost:3000 · CRM: http://localhost:3000/crm

> **Dikkat:** `npm run demo`, `npm run setup` ve `npm run db:reset` **tüm verileri siler** ve örnek veriyi baştan yükler.
> Yalnızca localhost veritabanında çalışırlar; bulut veritabanında durdurulurlar. Verileri korumak için `npm run dev` veya `npm start`.

| Komut | Açıklama |
|---|---|
| `npm run setup` | `.env` yoksa oluşturur, Prisma istemcisi, migration, örnek veri (**veriyi siler**) |
| `npm run db:reset` | Örnek veriyi baştan yükler (**veriyi siler**) |
| `npm run demo` | setup + build + start (**veriyi siler**) |
| `npm run db:seed:cloud` | Bulut veritabanına ilk yükleme (hiçbir şey silmez; veri varsa atlar) |
| `npm run dev` / `npm start` | Geliştirme / derlenmiş uygulama (veriler korunur) |
| `npm test` | Birim testleri (`TEST_DATABASE_URL` yerel PostgreSQL ister) |
| `npm run e2e` | Çalışan sunucuya karşı uçtan uca senaryo (test aracı ekler) |
| `npm run lint` / `npm run build` | Lint ve üretim derlemesi |

## Yerel demo hesapları

| Kullanıcı | E-posta | Rol |
|---|---|---|
| Yönetici (Demo) | yonetici@mirmotors.demo | Yönetici |
| Ahmet | ahmet@mirmotors.demo | Satış personeli |
| Mehmet | mehmet@mirmotors.demo | Satış personeli |

Yerel şifre `prisma/seed.ts` → `LOCAL_DEMO_PASSWORD` (yalnızca yerel örnek veri). Canlı ortamda farklı şifreler kullanılır ve bu depoda yer almaz.

## Teknolojiler

Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Prisma 6 + PostgreSQL (Neon) · Vercel Blob · jose + bcryptjs (oturum) · zod · Vitest ·
@anthropic-ai/sdk (canlı AI yolu, doğrulanmadı).

Ortam değişkenleri: [.env.example](.env.example) ve [BURAK_DEVIR.md](BURAK_DEVIR.md) → "Ortam değişkenleri".
