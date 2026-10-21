# Mir Motors — Galeri Sitesi + CRM (DEMO)

Mir Motors için kurumsal araç satış web sitesi ve galeri CRM'i demosu. Müşteri sitesi ile personel paneli aynı uygulamadadır;
araç ekleme → yayımlama → opsiyon → satış → ilanın kaldırılması zinciri veritabanı üzerinde gerçekten çalışır.

> Bu bir demo sürümüdür. Araçlar, fiyatlar ve görseller temsilidir. Üretim ortamı güvenlik sertifikası veya hukuki uyumluluk garantisi verilmez.

## Gereksinimler

- Node.js 20+ (24 ile test edildi), npm
- İsteğe bağlı: `ffmpeg` (canlı AI modunda videodan kare çıkarmak için)

## Kurulum ve çalıştırma

Tek komut (kurulum + örnek veri + üretim derlemesi + sunucu):

```bash
npm install
```

```bash
npm run demo
```

Site: http://localhost:3000 · CRM: http://localhost:3000/crm

> **Dikkat:** `npm run demo` her çalıştırmada örnek veriyi baştan yükler; eklenen araçlar ve yüklenen dosyalar silinir.
> Verileri koruyarak yeniden başlatmak için (derleme yapılmışsa) yalnızca `npm start` kullanın.

Geliştirme modunda çalıştırmak için:

```bash
npm run setup
```

```bash
npm run dev
```

| Komut | Açıklama |
|---|---|
| `npm run setup` | `.env` yoksa oluşturur, Prisma istemcisini üretir, SQLite şemasını kurar, örnek veriyi yükler |
| `npm run db:reset` | Demo verisini ve yüklenen dosyaları sıfırlar (sunum öncesi) |
| `npm run demo` | setup + build + start (**verileri sıfırlar**) |
| `npm start` | Derlenmiş uygulamayı başlatır (**veriler korunur**) |
| `npm test` | Durum makinesi birim testleri (eşzamanlılık testleri dahil) |
| `npm run e2e` | Çalışan sunucuya karşı 14 adımlık demo senaryosu testi (`node tests/e2e-demo.mjs http://localhost:3000`) |
| `npm run lint` / `npm run build` | Lint ve üretim derlemesi |

> `npm run e2e` veritabanına test aracı ekler; sunumdan önce `npm run db:reset` çalıştırın.

## Ortam değişkenleri

`.env.example` dosyasına bakın. Özet:

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | Evet | SQLite dosyası (`file:./dev.db` → `prisma/dev.db`) |
| `SESSION_SECRET` | Evet | Oturum çerezi imzalama anahtarı (setup otomatik üretir) |
| `ANTHROPIC_API_KEY` | Hayır | Canlı AI taslağı. Yoksa AI ekranı **Simülasyon Modu**'nda çalışır |
| `OPENAI_API_KEY` | Hayır | Ses → metin (Whisper). Yoksa transkript elle yapıştırılır |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Hayır | İlan sayfasındaki WhatsApp bağlantısı (demo numarası gerçek değildir) |
| `STORAGE_DIR` | Hayır | Yüklemelerin klasörü (varsayılan `./storage`) |
| `COOKIE_SECURE` | Hayır | HTTPS arkasında `1` |

## Demo kullanıcı hesapları

Tüm hesapların şifresi: `MirDemo2026!` (yalnızca yerel demo içindir)

| Kullanıcı | E-posta | Rol |
|---|---|---|
| Yönetici (Demo) | yonetici@mirmotors.demo | Yönetici |
| Ahmet | ahmet@mirmotors.demo | Satış personeli |
| Mehmet | mehmet@mirmotors.demo | Satış personeli |

## Kullanılan teknolojiler

- **Next.js 15** (App Router, TypeScript) — site, CRM ve API rotaları tek uygulamada
- **Tailwind CSS 4** — arayüz
- **Prisma 6 + SQLite** — yerel veritabanı (dosya: `prisma/dev.db`)
- **jose** (HS256 imzalı, httpOnly oturum çerezi) + **bcryptjs** (şifre özeti)
- **zod** — sunucu tarafı doğrulama ve AI çıktı şeması
- **@anthropic-ai/sdk** — AI taslak servisi (`claude-opus-5-5`, yapılandırılmış JSON çıktı)
- **Vitest** — birim testleri

## Proje yapısı

```
prisma/schema.prisma        Veri modeli (Vehicle, VehiclePhoto, StatusHistory, Sale, User)
prisma/seed.ts              Örnek veri (11 temsili araç, 3 kullanıcı)
src/lib/vehicle-status.ts   Durum makinesi — koşullu/atomik geçişler
src/lib/storage.ts          Dosya yükleme (tür, boyut, dosya imzası kontrolü)
src/lib/ai/                 AI taslak servisi, simülasyon verisi, kare çıkarma
src/middleware.ts           /crm ve /api/crm için oturum kontrolü
src/app/(site)/             Müşteri sitesi
src/app/crm/                CRM paneli
src/app/api/crm/            CRM API (her rota ayrıca sunucu tarafı yetki kontrolü yapar)
storage/public              Fotoğraf ve videolar (/media/... ile servis edilir)
storage/private             Ekspertiz PDF'leri (yalnızca oturumlu /api/crm/files/...)
```

Diğer belgeler: [DEMO_SCRIPT.md](DEMO_SCRIPT.md) · [STATUS.md](STATUS.md) · [DECISIONS.md](DECISIONS.md)
