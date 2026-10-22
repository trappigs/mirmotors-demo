# Mir Motors — Claude Code notları

Mir Motors ikinci el araç galerisi: müşteri sitesi (`/`) + personel CRM'i (`/crm`), tek Next.js 15 uygulaması. Durum: demo/prototip.
Önce oku: `BURAK_DEVIR.md` (mimari, durum tablosu), `DECISIONS.md` (kararlar), `BURAK_KURULUM.md` (kurulum).

## Dallar
- `vercel-deploy`: PostgreSQL (Neon) + Vercel Blob. Canlı demo (https://mirmotors-demo.vercel.app) bu daldan. Geliştirme buradan devam eder.
- `master`: ilk yerel SQLite sürümü (salt arşiv).

## Komutlar
- `npm run dev`, `npm run build`, `npm start`, `npm run lint`
- `npm test` → `TEST_DATABASE_URL` (localhost PostgreSQL) ister; tabloları boşaltır
- `npm run e2e` → çalışan sunucuya karşı senaryo; veritabanına test aracı ekler
- `npm run setup` / `npm run demo` / `npm run db:reset` → **tüm veriyi siler**, yalnızca localhost veritabanında çalışır

## Kurallar
- Durum geçişleri yalnızca `src/lib/vehicle-status.ts` üzerinden ve koşullu güncellemeyle (`WHERE id AND status ...`); yalnızca buton gizlemeye güvenme.
- Yetki: her `/api/crm` rotasında `requireApiUser()`; opsiyon sahipliği `src/lib/permissions.ts`.
- Dosyalar `src/lib/storage.ts` üzerinden (yerel `storage/` veya Blob). Ekspertiz PDF'i asla herkese açık rotadan servis edilmez.
- Müşteri sitesinde yalnızca `AVAILABLE` ve `OPTIONED` araçlar görünür; `SALE_PENDING`/`SOLD` detayları 404.
- Şema değişikliği: `prisma migrate dev` (yalnızca yerel) → migration'ı commit et. Neon'da reset/push/truncate yok.
- Uydurma veri yok: plaka, şasi, yetki belgesi no, müşteri yorumu, kampanya uydurulmaz. DEMO bandı ve `noindex` kalır.
- AI canlı yolu doğrulanmadı; simülasyonu "canlı AI" gibi sunma.
- Gizli değerleri (`.env*`, şifreler, tokenlar) commit etme veya belgelere yazma.
- Kod yorumları ve arayüz metinleri Türkçe.
