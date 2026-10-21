# Durum Raporu — 22.10.2026

## Gerçekten çalışan özellikler

**CRM**
- Personel girişi (Yönetici / Satış personeli), imzalı httpOnly çerez; `/crm` ve `/api/crm` sunucu tarafında korumalı
- Özet ekranı: toplam stok, satışta, opsiyonlu, satış bekleyen, satılan kartları; son işlemler; son satışlar
- Araç listesi (durum sekmeleri, arama), manuel araç ekleme (taslak), düzenleme
- Fotoğraf yükleme (çoklu), silme, kapak seçme; video yükleme/silme; ekspertiz PDF yükleme (yalnızca CRM'de görüntülenir)
- Dosya türü (uzantı + dosya imzası) ve boyut kontrolleri
- Fotoğrafsız yayımlama engeli (sunucu tarafı)
- Opsiyonlama, opsiyon kaldırma, satış başlatma, noter onayıyla satış tamamlama, yönetici satış iptali
- Koşullu/atomik durum geçişleri; eşzamanlı isteklerde yalnızca biri başarılı
- İşlem geçmişi (personel, tarih, önceki/sonraki durum) ve satış kayıtları korunuyor
- Yasal ilan alanları için veri modeli ve form alanları (boş bırakılabilir)

**Müşteri sitesi**
- Ana sayfa, Araçlarımız, Araç detayı, Hakkımızda, İletişim; mobil uyumlu; görünür "DEMO · Örnek Araçlar" bandı
- Filtreler: marka → modele bağlı model, min/maks fiyat, yıl, km, yakıt, vites, kasa, Satışta/Opsiyonlu
- Sıralama: yeni eklenen, fiyat artan/azalan, km artan, yıl azalan
- Detay: galeri, video oynatıcı (Range destekli), teknik özellikler, donanım, boya/değişen/hasar, ekspertiz özeti, durum, WhatsApp bağlantısı (wa.me linki)
- Opsiyonlu etiketi; satış bekleyen/satılmış/taslak araç listede yok ve eski bağlantı 404 "Bu ilan artık yayında değil"
- noindex (HTTP başlığı + meta + robots.txt)

## Simülasyon olan özellikler

- **AI ile video üzerinden giriş:** `ANTHROPIC_API_KEY` tanımlı olmadığı için demo ortamında **Simülasyon Modu** çalışır. Video gerçekten yüklenir, oynatılır ve araca bağlanır; ancak taslak alanları sabit örnek transkript ve örnek çıktıdan gelir. Ekranda açıkça "canlı AI analizi değildir" yazar.
- Canlı AI kodu (Claude, yapılandırılmış JSON, Whisper transkript, ffmpeg kare çıkarma) yazıldı, derleniyor ve ffmpeg komutu doğrulandı; **ancak gerçek API anahtarıyla uçtan uca test edilmedi.**
- WhatsApp: yalnızca `wa.me` bağlantısıdır (API entegrasyonu yok); demo numarası gerçek değildir.

## Eksik özellikler

- Ek filtreler: renk, paket, motor gücü, çekiş, boya/değişen, hasar, donanım (veri var, filtre arayüzü yok)
- Fotoğraf sıralamasını değiştirme (yalnızca kapak seçimi var)
- Kullanıcı yönetimi, şifre değiştirme, giriş denemesi sınırlama
- Otomatik opsiyon süresi (yönetici manuel kaldırıyor — kapsam gereği)
- Kapsam dışı bırakılanlar: DECISIONS.md → Ertelenen kapsam

## Bilinen sorunlar / sınırlamalar

- Seed araçların görselleri SVG illüstrasyondur (gerçek fotoğraf değil); demo sırasında eklenen araç gerçek fotoğraflarla gösterilmeli.
- Aynı tarayıcıda tek oturum vardır; Ahmet/Mehmet/Yönetici için gizli pencere veya ayrı tarayıcı profili gerekir.
- Yüklenen görseller yeniden boyutlandırılmaz/optimize edilmez; çok büyük fotoğraflar mobilde yavaş yüklenebilir.
- Video dönüştürme yok: `.mov` (HEVC) dosyaları bazı tarayıcılarda (ör. Chrome/Windows) oynatılamayabilir; demo için MP4 (H.264) önerilir.
- SQLite tek dosya; çok kullanıcılı üretim yükü için uygun değildir.
- `npm run e2e` veritabanına test aracı ekler; sunum öncesi `npm run db:reset` gerekir.

## Kabul testleri — sonuçlar

Ortam: Windows 11, Node 24.18, üretim derlemesi (`next build` + `next start`).

| Test | Sonuç | Nasıl doğrulandı |
|---|---|---|
| Proje tek komutla çalışıyor | GEÇTİ | `npm run demo` (setup + build + start); `.env` otomatik oluşturma ayrı klasörde denendi |
| CRM'e giriş yapılabiliyor | GEÇTİ | E2E + tarayıcı (Playwright) |
| Yeni araç oluşturulabiliyor | GEÇTİ | E2E (API) + Playwright (form) |
| Fotoğraf yüklenebiliyor | GEÇTİ | E2E + Playwright (dosya seçici) |
| Fotoğraf olmadan araç yayımlanamıyor | GEÇTİ | Birim testi + E2E + Playwright |
| Yayımlanan araç ön yüzde görünüyor | GEÇTİ | E2E + Playwright |
| Marka ve fiyat filtreleri çalışıyor | GEÇTİ | E2E (dahil/hariç senaryoları) + Playwright |
| Araç detay sayfası çalışıyor | GEÇTİ | E2E + tarayıcı |
| Video varsa oynatılıyor | GEÇTİ (kısmen) | Video etiketi ve HTTP 206 Range yanıtı doğrulandı; oynatma tarayıcıda gözle izlenmedi |
| Ahmet aracı opsiyonlayabiliyor | GEÇTİ | Birim testi + E2E |
| Mehmet aynı araca satış başlatamıyor | GEÇTİ | Birim testi + E2E (409) + tarayıcıda hata mesajı görüldü |
| Opsiyonlu etiketi müşteri sitesine yansıyor | GEÇTİ | E2E + tarayıcı |
| Satış bekleyen araç gizleniyor | GEÇTİ | E2E (liste + detay 404) |
| Satılan araç listeden ve aktif detay bağlantısından kaldırılıyor | GEÇTİ | E2E |
| Satış CRM geçmişinde korunuyor | GEÇTİ | Birim testi + E2E |
| Sayfa yenileme verileri kaybettirmiyor | GEÇTİ | Sunucu yeniden başlatıldıktan sonra UI ile eklenen araç hâlâ yayında |
| Mobil görünüm kullanılabilir | GEÇTİ (görsel kontrol) | 375 px genişlikte liste ve detay ekranları incelendi; CRM tablosu mobilde yatay kaydırmalı |
| Build ve temel testler geçiyor | GEÇTİ | `npm run lint`, `tsc`, `npm test` (7/7), `next build`, `npm run e2e` (41/41) |
| Eşzamanlı çift işlem koruması | GEÇTİ | Birim testi (5 tur paralel opsiyon + paralel satış) + E2E paralel istek |
| Canlı AI taslağı | TEST EDİLMEDİ | API anahtarı yok; yalnızca simülasyon modu test edildi |

## Sırada ne var

1. Gerçek BMW fotoğraflarıyla demo provası (DEMO_SCRIPT.md)
2. API anahtarı sağlanırsa canlı AI yolunun gerçek bir araç videosuyla denenmesi
3. Ek filtreler ve görsel optimizasyonu
