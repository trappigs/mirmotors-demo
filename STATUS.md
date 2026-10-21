# Durum Raporu — 22.10.2026 (son demo kontrolü)

## Gerçekten çalışan özellikler

**CRM**
- Personel girişi (Yönetici / Satış personeli), imzalı httpOnly çerez; `/crm` ve `/api/crm` sunucu tarafında korumalı
- Giriş denemesi sınırı (IP+e-posta başına 10, e-posta başına 30 hatalı deneme / 15 dk), sabit süreli şifre karşılaştırma
- Özet ekranı: toplam stok, satışta, opsiyonlu, satış bekleyen, satılan kartları; son işlemler; son satışlar
- Araç listesi (durum sekmeleri, arama), manuel araç ekleme (taslak), düzenleme
- Fotoğraf yükleme (çoklu), silme, kapak seçme; video yükleme/silme; ekspertiz PDF yükleme (yalnızca CRM'de)
- Dosya türü (uzantı + dosya imzası) ve boyut kontrolleri
- Fotoğrafsız yayımlama engeli (sunucu tarafı)
- Opsiyonlama, opsiyon kaldırma, satış başlatma, noter onayıyla satış tamamlama, yönetici satış iptali
- Koşullu/atomik durum geçişleri; eşzamanlı isteklerde yalnızca biri başarılı
- Opsiyonlu araçta bilgi ve medya değişikliği yalnızca opsiyon sahibi veya yönetici
- İşlem geçmişi (personel, tarih, önceki/sonraki durum) ve satış kayıtları korunuyor
- Yasal ilan alanları için veri modeli ve form alanları (boş bırakılabilir)

**Müşteri sitesi**
- Ana sayfa, Araçlarımız, Araç detayı, Hakkımızda, İletişim; mobil uyumlu; her sayfada "DEMO · Örnek Araçlar" bandı
- Filtreler: marka → modele bağlı model, min/maks fiyat, yıl, km, yakıt, vites, kasa, Satışta/Opsiyonlu
- Sıralama: yeni eklenen, fiyat artan/azalan, km artan, yıl azalan
- Detay: galeri, video oynatıcı (Range destekli), özellikler, donanım, boya/değişen/hasar, ekspertiz özeti, durum, WhatsApp bağlantısı (wa.me)
- Opsiyonlu etiketi; satış bekleyen/satılmış/taslak araç listede yok, eski bağlantı HTTP 404 "Bu ilan artık yayında değil"
- noindex (HTTP başlığı + meta + robots.txt)

## Simülasyon olan özellikler

- **AI ile video üzerinden giriş:** `ANTHROPIC_API_KEY` tanımlı olmadığı için **Simülasyon Modu**. Video gerçekten yüklenir ve araca bağlanır; taslak alanları sabit örnek transkript/çıktıdan gelir. Ekranda "canlı AI analizi değildir" yazar.
- Canlı AI kodu (Claude yapılandırılmış çıktı, Whisper, ffmpeg kare çıkarma) yazıldı ve derleniyor; **gerçek API anahtarıyla test edilmedi.**
- WhatsApp: yalnızca `wa.me` bağlantısı; demo numarası (905000000000) gerçek değildir.
- Seed araç görselleri SVG illüstrasyondur ("TEMSİLİ GÖRSEL").

## Eksik özellikler

- Ek filtreler: renk, paket, motor gücü, çekiş, boya/değişen, hasar, donanım (veri var, filtre arayüzü yok)
- Fotoğraf sıralamasını değiştirme (yalnızca kapak seçimi var)
- Kullanıcı yönetimi, şifre değiştirme
- Otomatik opsiyon süresi (kapsam gereği manuel)
- Kapsam dışı bırakılanlar: DECISIONS.md → Ertelenen kapsam

## Bilinen sorunlar / sınırlamalar

- `npm run demo` her çalıştırmada verileri sıfırlar (bilinçli). Verileri korumak için `npm start`.
- Aynı tarayıcı profilinde tek oturum vardır; personel hesapları için ayrı profiller gerekir (DEMO_SCRIPT.md).
- Yüklenen görseller yeniden boyutlandırılmaz; çok büyük fotoğraflar mobilde yavaş yüklenebilir.
- Video dönüştürme yok: `.mov` (HEVC) bazı tarayıcılarda oynamayabilir; MP4 (H.264) kullanın.
- Medya yükleme yetki kontrolü ile kayıt arasında çok kısa bir yarış penceresi var (bkz. DECISIONS.md); demo etkisi yok.
- Giriş denemesi sınırı bellek içidir; sunucu yeniden başlatılınca sıfırlanır.

## Kabul testleri — son sonuçlar (22.10.2026)

Ortam: Windows 11, Node 24.18, üretim derlemesi. **Başarısız test yok.**

| Test | Sonuç | Nasıl doğrulandı |
|---|---|---|
| Temiz kurulum (`npm install` + `npm run demo`) | GEÇTİ | Yedekten boş klasöre klonlandı (.env/DB/node_modules yok); ~27 sn'de ayağa kalktı |
| Demo hesap girişleri (3 hesap) | GEÇTİ | Temiz kurulumda 3×200; yanlış şifre 401 |
| Temel sayfalar hatasız | GEÇTİ | Temiz kurulumda 6 site + 5 CRM sayfası 200; oturumsuz CRM → giriş yönlendirmesi |
| 1. Yönetici girişi | GEÇTİ | Gerçek arayüz (Playwright, ayrı tarayıcı bağlamı) |
| 2. Manuel BMW kaydı | GEÇTİ | Arayüz formu |
| 3. Gerçek görsel dosyası yükleme | GEÇTİ | Dosya seçiciyle 3 JPG yüklendi ve görüntülendi |
| Fotoğrafsız yayımlama engeli | GEÇTİ | Arayüz + birim testi + E2E |
| 4. Yayımlama | GEÇTİ | Arayüz |
| 5. Müşteri sitesinde bulma | GEÇTİ | Arayüz |
| 6. Filtreleme (BMW, ≤ 4.000.000 TL) | GEÇTİ | Arayüz formu: 2 sonuç, hedef araç listede |
| 7. Ahmet opsiyonlar + Opsiyonlu etiketi | GEÇTİ | Arayüz (Ahmet bağlamı + müşteri bağlamı) |
| 8. Mehmet satış başlatamaz | GEÇTİ | Arayüz: "Bu araç Ahmet tarafından opsiyonlanmış. İşlem engellendi."; durum değişmedi |
| 9. Yetkili hesapla satışı tamamlama (noter) | GEÇTİ | Ahmet satışı başlattı, Yönetici noter onayıyla tamamladı |
| 10. İlan tamamen kaldırıldı | GEÇTİ | Listede yok; eski bağlantı HTTP 404 "Bu ilan artık yayında değil" |
| Satış CRM geçmişinde korunuyor | GEÇTİ | Satış kaydı: başlatan, fiyat, noter tarihi, tamamlayan |
| Satış bekleyen araç gizli | GEÇTİ | E2E |
| Video oynatma | GEÇTİ (kısmen) | Oynatıcı ve HTTP 206 Range yanıtı doğrulandı; oynatma gözle izlenmedi |
| Sayfa yenileme / sunucu yeniden başlatma veri kaybı | GEÇTİ | Yeniden başlatma sonrası araç yerinde |
| `db:reset` sonrası açık oturumlar | GEÇTİ (düzeltildi) | Önceden oturumlar düşüyordu; seed kullanıcılarına sabit kimlik verildi |
| Mobil görünüm | GEÇTİ | 390 px: liste, detay (fiyat/WhatsApp üstte), CRM giriş; yatay taşma yok |
| Demo bandı tüm sitede | GEÇTİ | 6 sayfada (404 dahil) |
| EİDS/ödeme iddiası yok | GEÇTİ | Müşteri sayfalarında taranarak doğrulandı |
| CRM API oturumsuz/sahte çerezle erişim | GEÇTİ | 8 uç nokta 401; satış personeli yönetici işlemine 403 |
| Seed'de kişisel veri yok | GEÇTİ | Tarama |
| Lint / TypeScript / build | GEÇTİ | `npm run lint`, `tsc`, `next build` |
| Birim testleri | GEÇTİ | 7/7 (eşzamanlılık dahil) |
| E2E API senaryosu | GEÇTİ | 43/43 (önceki raporda "41/41" yazılmıştı; doğru sayı o zaman 40/40 idi) |
| Canlı AI taslağı | TEST EDİLMEDİ | API anahtarı yok |

## Yedekler

- Git: `master` dalı, commit geçmişi için `git log`
- Yerel yedek: `C:\Users\Mami\Projeler\mirmotors-demo-yedek\` (git bundle + kaynak zip)
- Yedek sunum: `demo-assets/yedek-sunum/` (19 masaüstü + 3 mobil ekran görüntüsü, 76 sn altyazılı video)
