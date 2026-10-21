# Mir Motors — Canlı Demo Akışı (5–7 dakika)

## Sunumdan önce (10 dk)

1. Verileri sıfırla ve sunucuyu başlat:
   ```bash
   npm run db:reset
   ```
   ```bash
   npm run build && npm run start
   ```
2. Masaüstüne **3–5 adet BMW fotoğrafı** koyun (JPG/PNG/WEBP, her biri 10 MB altı). Kendi çektiğiniz veya kullanım hakkına sahip olduğunuz temsili görseller olmalı.
3. İsteğe bağlı: kısa bir araç videosu (MP4, 200 MB altı). Yoksa `demo-assets/ornek-test-videosu.mp4` (test deseni) kullanılabilir.
4. Tarayıcıda iki pencere açın:
   - **Pencere A (CRM):** http://localhost:3000/crm — Ahmet ile giriş yapılmış (`ahmet@mirmotors.demo` / `MirDemo2026!`)
   - **Pencere B (Müşteri sitesi):** http://localhost:3000/araclar
   - Mehmet ve Yönetici için **gizli pencere** veya ikinci tarayıcı profili hazırlayın (aynı tarayıcıda tek oturum vardır).
5. Örnek stok hazır: 11 temsili araç (8 satışta, 1 opsiyonlu Porsche Macan, 1 satış bekleyen Evoque, 1 satılmış Audi A5, 1 taslak Mini). Hepsi "TEMSİLİ GÖRSEL" etiketlidir.

## Akış

| Süre | Ekran | Ne gösterilir / ne söylenir |
|---|---|---|
| 0:00 | Pencere B — Ana sayfa | "DEMO / Örnek Araçlar" bandı, premium tasarım, öne çıkan araçlar. Mobilde de çalıştığını belirtin (tarayıcıyı daraltın). |
| 0:40 | Pencere A — CRM Özet | (Adım 1) Ahmet olarak girildi. Kartlar: toplam stok, satışta, opsiyonlu, satış bekleyen, satılan. Son işlemler listesi. |
| 1:00 | CRM → **+ Araç ekle → Manuel giriş** | (Adım 2, 4) BMW 5 Serisi, 520i M Sport, 2023, 12.000 km, 3.675.000 TL, Benzin/Otomatik/Sedan. Donanımdan birkaç seçim. Boya/değişen/hasar ve ekspertiz özeti. **Taslak olarak kaydet**. |
| 2:00 | Araç sayfası | Önce **Kontrol ettim, yayımla**'ya basın → "en az 1 fotoğraf" hatası (kural sunucuda). (Adım 3) **Bilgisayardan fotoğraf yükle** → masaüstündeki BMW fotoğrafları. Bir fotoğrafı **Kapak yap**. İsterseniz video ve ekspertiz PDF'i yükleyin (PDF yalnızca CRM'de görünür). |
| 2:45 | Araç sayfası | (Adım 5) **Kontrol ettim, yayımla** → "Satışta". İşlem geçmişine yazıldığını gösterin. |
| 3:00 | Pencere B — Araçlarımız | (Adım 6–7) Sayfayı yenileyin; BMW listede. Filtre: Marka **BMW**, Maks. fiyat **4.000.000** → Filtrele. Sıralama: Fiyat artan. |
| 3:30 | Pencere B — Detay | (Adım 8) Fotoğraf galerisi, video oynatıcı, teknik özellikler, donanım, boya/değişen, ekspertiz özeti, WhatsApp butonu. |
| 4:00 | Pencere A — CRM araç sayfası | (Adım 9) Ahmet **Opsiyonla** → "Opsiyon sahibi: Ahmet (siz)". |
| 4:15 | Pencere B | (Adım 10) Yenileyin → kartta ve detayda **Opsiyonlu** etiketi. |
| 4:30 | Gizli pencere — Mehmet | Mehmet ile giriş, aynı araç sayfası → **Satış sürecini başlat** → kırmızı uyarı: "Bu araç Ahmet tarafından opsiyonlanmış. İşlem engellendi." (Adım 11). Vurgu: buton gizlenmedi; kontrol veritabanında koşullu güncelleme ile yapılıyor, iki eşzamanlı istekten yalnızca biri başarılı olur. |
| 5:00 | Pencere A — Ahmet | (Adım 12) Anlaşılan fiyatı girip **Satış sürecini başlat** → "Satış Bekliyor". Pencere B'de yenileyin: ilan listeden kalktı, eski bağlantı "Bu ilan artık yayında değil". |
| 5:30 | Gizli pencere — Yönetici | Yönetici ile giriş (veya Ahmet devam edebilir: satışı başlatan kişi de tamamlayabilir). **Noter devri tamamlandı** kutusu + tarih → **Satışı tamamla**. (Adım 13) "Satıldı". |
| 6:00 | Pencere B | Liste ve eski detay bağlantısı: araç yok. |
| 6:15 | CRM araç sayfası | (Adım 14) **Satış kayıtları**: başlatan, anlaşılan fiyat, noter tarihi, tamamlayan. **İşlem geçmişi**: her durum değişikliği kişi + tarih + önceki/sonraki durumla. CRM Özet'te "Satılan araçlar" arttı. |
| 6:40 | (İsteğe bağlı) **+ Araç ekle → AI ile video** | Video yükle → taslak. API anahtarı yoksa ekranda **SİMÜLASYON MODU** yazar; bunu canlı AI olarak tanıtmayın. Mavi alanlar AI önerisidir; fiyat/hasar/ekspertiz onay kutuları işaretlenmeden kayıt olmaz. |

## Sık sorulara hazır cevaplar

- **Ödeme / kapora?** Bilinçli olarak yok; satış galeride ve noterde tamamlanır.
- **EİDS?** Entegre değil; hukuki gereklilik netleşince eklenecek. Yasal alanlar için veri modeli hazır (CRM'de "Yasal ilan alanları").
- **Ekspertiz PDF'i müşteriye açık mı?** Hayır, onay bekliyor; yalnızca CRM'de görüntülenir.
- **Opsiyon süresi?** Bu demoda yönetici manuel kaldırır; otomatik süre V1 sonrası.

## Sorun olursa

- Veriler karıştıysa: `npm run db:reset` (sunucu açıkken de çalışır; sayfayı yenileyin).
- Oturum karıştıysa: sağ üstten **Çıkış**, tekrar giriş.
