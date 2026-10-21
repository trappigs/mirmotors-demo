# Mir Motors — Canlı Demo Akışı (5–7 dakika)

## Önemli: `npm run demo` her çalıştırmada verileri SIFIRLAR

`npm run demo` = kurulum + **örnek veriyi baştan yükleme** + derleme + başlatma. Demo sırasında eklenen araçlar,
yüklenen fotoğraflar ve satış kayıtları silinir. Sunum sırasında sunucuyu yeniden başlatmanız gerekirse **verileri
korumak için** yalnızca şunu çalıştırın (derleme zaten yapılmış olmalı):

```bash
npm start
```

| Komut | Veriler | Ne zaman |
|---|---|---|
| `npm run demo` | **Sıfırlanır** | Sunumdan önce, bir kez |
| `npm start` | Korunur | Sunum sırasında sunucu kapanırsa |
| `npm run db:reset` | **Sıfırlanır** (sunucu açıkken de çalışır) | Prova sonrası temiz başlangıç için |

## Sunumdan önce (15 dk)

1. Terminalde proje klasöründe:
   ```bash
   npm run demo
   ```
   "Ready" yazısını bekleyin. Port 3000 doluysa PowerShell'de önce `$env:PORT=3001` yazın ve adresleri buna göre kullanın.
2. **Örnek araç:** BMW 5 Serisi · 520i M Sport · 2023 · 12.000 km · 3.675.000 TL · Benzin / Otomatik / Sedan · Karbon Siyahı · 170 hp · Arkadan İtiş.
3. **Fotoğraflar:** Kendi çektiğiniz/kullanım hakkına sahip olduğunuz 3–5 BMW fotoğrafını masaüstüne koyun (JPG/PNG/WEBP, 10 MB altı).
   Hazır yedek: `demo-assets/ornek-bmw-temsili-1.jpg`, `-2.jpg`, `-3.jpg` ("TEMSİLİ GÖRSEL · DEMO" yazılı illüstrasyonlar).
4. İsteğe bağlı video: kısa MP4 (H.264, 200 MB altı). `.mov` (iPhone HEVC) Chrome'da oynamayabilir — MP4 kullanın.
5. **Ayrı tarayıcı profilleri** (aynı profilde tek oturum olur; bir hesapla giriş diğerini kapatır):
   - Chrome'da sağ üst profil simgesi → **Ekle** → "Demo-Yönetici", "Demo-Ahmet", "Demo-Mehmet" profilleri (misafir profili de olur).
   - Alternatif: Yönetici = Chrome normal pencere, Ahmet = Edge, Mehmet = Chrome gizli pencere (Ctrl+Shift+N).
   - Müşteri sitesi için ayrı bir sekme/pencere (oturum gerektirmez).
6. Her profilde önceden giriş yapın:

| Profil | Adres | E-posta | Şifre |
|---|---|---|---|
| Yönetici | http://localhost:3000/crm/login | yonetici@mirmotors.demo | MirDemo2026! |
| Ahmet | http://localhost:3000/crm/login | ahmet@mirmotors.demo | MirDemo2026! |
| Mehmet | http://localhost:3000/crm/login | mehmet@mirmotors.demo | MirDemo2026! |
| Müşteri | http://localhost:3000/araclar | — | — |

> Aynı e-posta ile 10 kez yanlış şifre girilirse giriş 15 dakika kilitlenir. Olursa sunucuyu `npm start` ile yeniden başlatmak kilidi kaldırır (veriler korunur).

7. Örnek stok hazır: 11 temsili araç (8 satışta, 1 opsiyonlu Porsche Macan, 1 satış bekleyen Evoque, 1 satılmış Audi A5, 1 taslak Mini).

## Akış (≈6 dakika)

| Süre | Profil / ekran | Adım ve anlatım |
|---|---|---|
| 0:00 | Müşteri — http://localhost:3000/ | "DEMO · Örnek Araçlar" bandı, tasarım. Bunun bir demo olduğunu, ilanların temsili olduğunu söyleyin. |
| 0:30 | Yönetici — http://localhost:3000/crm | Özet kartları (stok, satışta, opsiyonlu, satış bekleyen, satılan) ve son işlemler. |
| 0:50 | Yönetici — **+ Yeni araç ekle → Manuel giriş** | Örnek BMW bilgilerini girin, 3–4 donanım seçin, boya/değişen "Yok", ekspertiz özeti. **Taslak olarak kaydet ve devam et**. |
| 2:00 | Yönetici — araç sayfası | Önce **Kontrol ettim, yayımla** → "en az 1 fotoğraf" uyarısı (kural sunucuda). **Bilgisayardan fotoğraf yükle** → fotoğrafları seçin. Bir fotoğrafa **Kapak yap**. **Kontrol ettim, yayımla** → "Satışta". |
| 2:45 | Müşteri — http://localhost:3000/araclar | Yenileyin; BMW listede. Marka **BMW**, Maks. fiyat **4000000** → **Filtrele**. İlanı açın: galeri, özellikler, ekspertiz özeti, WhatsApp. |
| 3:30 | Ahmet — aynı aracın CRM sayfası (Araçlar listesinden) | **Opsiyonla** → "Opsiyon sahibi: Ahmet (siz)". |
| 3:45 | Müşteri | Yenileyin → **Opsiyonlu** etiketi. |
| 4:00 | Mehmet — aynı aracın CRM sayfası | **Satış sürecini başlat** → kırmızı uyarı "Bu araç Ahmet tarafından opsiyonlanmış. İşlem engellendi." Vurgu: kontrol sunucuda/veritabanında; aynı anda iki istek gelirse yalnızca biri geçer. Mehmet aracın bilgilerini de değiştiremez. |
| 4:30 | Ahmet | Anlaşılan fiyatı girin → **Satış sürecini başlat** → "Satış Bekliyor". Müşteri sekmesinde yenileyin: ilan listeden kalktı. |
| 5:00 | Yönetici | Sayfayı yenileyin → **Noter devri tamamlandı** kutusu + tarih → **Satışı tamamla** → "Satıldı". |
| 5:20 | Müşteri | Liste: araç yok. Eski ilan bağlantısı: "Bu ilan artık yayında değil". |
| 5:40 | Yönetici — araç sayfası | **Satış kayıtları** (başlatan Ahmet, fiyat, noter tarihi, tamamlayan) ve **İşlem geçmişi**. Özet ekranında "Satılan araçlar" arttı. |
| 6:10 | (İsteğe bağlı) Yönetici — **+ Araç ekle → AI ile video** | Video yükleyin → sarı **SİMÜLASYON MODU** bandı. "Canlı AI değil; API anahtarı bağlandığında aynı ekran gerçek analiz yapar." Fiyat/hasar/ekspertiz onayı olmadan kayıt alınmaz. |

## Demo başarısız olursa (yedek plan)

1. **Sunucu kapandı:** terminalde `npm start` (veriler korunur). Derleme yoksa `npm run build` sonra `npm start`.
2. **Veriler karıştı / bir adım yanlış gitti:** `npm run db:reset`, tarayıcıda yenileyin, adımlara baştan başlayın (giriş oturumları geçerli kalır).
3. **Bilgisayar/uygulama tamamen çalışmıyor:** hazır yedekleri gösterin:
   - Ekran görüntüleri (tüm 10 adım, gerçek arayüzden): `demo-assets/yedek-sunum/01-…png` – `19-…png`, mobil: `mobil-1/2/3-…png`
   - Altyazılı yedek video (76 sn): `demo-assets/yedek-sunum/mirmotors-demo-yedek-video.mp4`
4. **Proje klasörü bozuldu:** yedekten geri yükleyin — `C:\Users\Mami\Projeler\mirmotors-demo-yedek\` (git bundle + kaynak zip). Geri yükleme: `git clone <bundle> yeni-klasor`, sonra `npm install` ve `npm run demo`.

## Sık sorulara hazır cevaplar

- **Ödeme / kapora?** Bilinçli olarak yok; satış galeride ve noterde tamamlanır.
- **EİDS?** Entegre değil; hukuki gereklilik netleşince eklenecek. Yasal alanlar için veri modeli hazır (CRM'de "Yasal ilan alanları").
- **Ekspertiz PDF'i müşteriye açık mı?** Hayır, onay bekliyor; yalnızca CRM'de görüntülenir.
- **Opsiyon süresi?** Bu demoda yönetici manuel kaldırır; otomatik süre V1 sonrası.
- **AI gerçek mi?** Bu demoda simülasyon. Servis katmanı hazır; API anahtarı ile canlı mod henüz test edilmedi.
