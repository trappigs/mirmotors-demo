# Mir Motors — Demo V1 Teslim Raporu (22.10.2026)

Dal: `demo-v1` (başlangıç: `vercel-deploy` @ `49fff59`, checkpoint etiketi `checkpoint-oncesi-demo-v1`).
Kapsam: "Demo V1 güncel geliştirme talimatı", demo için gerekli olanlarla sınırlı tutuldu (aşağıda "Bilinçli olarak yapılmayanlar").

## Tamamlananlar

| Talimat maddesi | Yapılan |
|---|---|
| 1. Gerçek logo | İşletmenin gönderdiği logo yalnızca kırpılarak kullanıldı (`public/brand/`); yeniden çizilmedi. Üst menü, mobil menü, alt bilgi, favicon (`src/app/icon.png`, `apple-icon.png`). Logo siyah zeminli olduğu için menü ve alt bilgi siyah. **Dosya 444 px; keskin görünüm için işletmeden SVG veya büyük PNG istenmeli.** |
| 1. Renk / tema | Kullanıcı kararıyla: logoya uygun ama sade. Zemin kırık beyaz, siyah yalnızca menü / düğme / fiyat bandında, altın yalnızca vurgularda. Kırmızı tema kaldırıldı. |
| 2. Fotoğraflar | "Fotoğraf eklenmedi" alanı (kart, galeri, CRM). Fotoğraf sıralama (‹ › oklar, `PATCH /photos`), kapak seçme, ekleme, silme. Fotoğrafsız yayın engeli korunuyor. Yerelde yüklenen fotoğraf otomatik küçültülür (en uzun kenar 1920 px), EXIF yönü uygulanır, konum dahil meta veri silinir. Kartlarda tembel yükleme. **Örnek araçların temsilî (Unsplash) fotoğrafları kullanıcı kararıyla şimdilik kaldı.** |
| 2. Analiz videosu | Video (AI veya elle) müşteriye **otomatik açılmaz** (`videoPublic`). CRM'de "müşteri sitesinde yayımla" kutusu; işlem geçmişine yazılır. Onaysız videonun adresi oturumsuz 404. |
| 3. Kaporta şeması | SVG şema (referans ekran görüntüsündeki düzen ve renkler), 13 parça, her parça ayrı satır (`VehiclePart`). Varsayılan "Bilinmiyor" (taralı). "Tüm parçalar orijinal" yalnızca 13 parça doğrulanınca. Personel beyanı ve ekspertiz raporu ayrı işaretlenir; çelişen parça kırmızı uyarı. Değiştiren personel + tarih saklanır, işlem geçmişine parça adlarıyla yazılır. Sitede aynı şema: üzerine gelince / dokununca parça adı ve durumu; yanında boya/değişen özeti, tramer, hasar kaydı. AI parça durumu belirlemez. |
| 3. Tramer | Boş = "Bilgi girilmedi" (0 TL / "Tramer yok" yazılmaz). Hasar kaydı durumu ayrı alan (yok / var / ağır hasar / bilgi girilmedi). |
| 4. Filtreler | Temel: marka → model → **seri/paket** (bağımlı, yayındaki araçlardan), fiyat/yıl/km aralığı (ters girilen aralık düzeltilir), yakıt, vites, kasa, durum, metin araması. Gelişmiş: renk, motor hacmi, motor gücü, çekiş, boyalı / lokal boyalı / değişen var-yok, hasar kaydı, ağır hasar, donanım (çoklu, hepsi olmalı), ekspertiz raporu var-yok. Bilinmeyen bilgi hiçbir "yok" filtresine girmez. Doğru toplam sonuç sayısı, sayfalama (12'li), sıralamaya "model yılı artan" eklendi, filtreleri temizle, mobilde tam ekran panel. Sonuçlar gerçek veritabanı sorgusundan. |
| 5. AI ile video | Ekran üç bölüm: 1) bulunan bilgiler, 2) eksik / doğrulanacaklar (+ her zaman personelin girdiği alanlar), 3) personel onayı. Bilgi eksikse hata yok: eksik alanlarla taslak oluşur (araç alanları taslakta boş olabilir; yayımlama eksikleri listeler). Simülasyon büyük "AI SİMÜLASYONU — gerçek analiz değildir" bandıyla. Canlı yolda hiçbir bilgi çıkmazsa 422 yerine boş taslak; Whisper isteğine 120 sn zaman aşımı. |
| 6. Araç detayı | Galeri, onaylı video, teknik özellikler, donanım, kaporta şeması, hasar/tramer, ekspertiz özeti, durum, WhatsApp, **İlan bilgileri** bölümü (ticari unvan, yetki belgesi, plaka, şasi son 6 hane, rehin/haciz, garanti, ilan no; bilinmeyen "Bilgi girilmedi"). EİDS ibaresi yok. |
| 6. Yasal alanlar | CRM'de: plaka, şasi **yalnızca son 6 hane**, rehin/haciz, kalan garanti, tescil (işletme adına mı), ilan no. İşletme bilgileri ortam değişkeninden (`COMPANY_*`). `REQUIRE_LEGAL_FIELDS=1` iken eksik ilan yayımlanamaz; demo'da CRM'de uyarı listesi. |
| 7. Stok / satış | Durum makinesi aynen korundu. Satılmış / satış bekleyen / taslak aracın foto ve videosu artık doğrudan adresle de açılmaz (404); CDN önbelleği 1 yıl yerine 5 dk. |
| 8. Güvenlik (kullanıcı kararıyla yalnızca demo için gerekli 3 madde) | Her personelin şifresi farklı (yerel + bulut seed), canlı veritabanında veri silmeden şifre ayırmak için `npm run personel:sifre`. Yetkisiz medya erişimi kapatıldı. Analiz videosu onaysız yayımlanmıyor. |
| Küçük düzeltmeler | CRM araç araması büyük/küçük harf duyarsız; ekspertiz PDF silme düğmesi; AI etiketinin Vercel'de "canlı" görünmesi düzeltildi. |

## Test sonuçları (bu bilgisayar, üretim derlemesi)

| Test | Sonuç |
|---|---|
| `npm run lint` | Geçti |
| `tsc --noEmit` | Geçti |
| `npm run build` | Geçti |
| Birim testleri (`npm test`) | **16/16** (7 eski + 9 yeni: kaporta özeti, çelişki, parça kaydı, bilinmeyen bilginin "yok" filtrelerine girmemesi, hasar filtreleri, aralık / ters aralık / paket / donanım / kombinasyon, gizli durumlar, eksik bilgiyle taslak, şasi son 6 hane) |
| E2E (`npm run e2e`) | **123/123** (önceki 65 + ayrı şifreler, taslak medyası gizliliği, kaporta kaydı / geçersiz parça / çelişki / geçmiş, AI taslağı onay + eksik bilgi, 31 gelişmiş filtre, paket bağımlılığı, sonuç sayısı, sayfalama, bilinmeyen kaporta/tramer, video onayı, satış sonrası medya 404, eşzamanlı satış) |
| Tarayıcı (elle) | Masaüstü: logo, şema (site + CRM'de tıklayarak işaretleme ve kaydetme). Mobil 375 px: yatay taşma yok, filtre paneli tam ekran, marka → model → paket bağımlılığı, sonuç sayısı. AI rotası simülasyonla denendi, analiz videosu oturumsuz 404. |

## Veritabanı

- Migration: `prisma/migrations/20261022120000_demo_v1_kaporta_yasal_video` — **yalnızca ekleme ve NOT NULL kaldırma**, veri silmez. Önceden elle yüklenmiş videolar açık kalır (`videoPublic=true`), AI videoları kapalı başlar.
- Canlı (Neon) veritabanına **uygulanmadı**; Vercel'e deploy edilince `prisma migrate deploy` uygular. Deploy yetkisi henüz yok.

## Bilinçli olarak yapılmayanlar (demo için gerekmedi / kullanıcı kararı)

- Kullanıcı yönetimi ve şifre değiştirme ekranı (yerine komut satırı betiği), oturum iptali, CSRF jetonu, güvenlik başlıkları (CSP/HSTS), bağımlılıkların büyük sürüm yükseltmesi (Next 16 / Prisma 7).
- Vercel Blob ortamında fotoğraf küçültme (yalnızca yerel yüklemede var); canlı AI'nın Vercel'de çalışması.
- Örnek araçların temsilî fotoğraflarının kaldırılması (kullanıcı: "şimdilik kalsın"). Ana sayfa slider'ı da bu fotoğrafları kullanıyor.
- Peşinat filtresi (talimat gereği), WhatsApp botu, Instagram DM, EİDS API.

## Bilinen sınırlamalar

- Logo dosyası düşük çözünürlüklü (444 px).
- Canlıdaki 3 personel hesabı hâlâ aynı şifreyi kullanıyor; `npm run personel:sifre` ile ayrılmalı (canlı veritabanı erişimi gerekir).
- Seed statik fotoğrafları (`/demo-cars/...`) satılmış örnek araçta da `public/` altından açılır (paylaşılan demo görselleri); kural personelin yüklediği medya için geçerli.
- Kaporta şeması yalnızca 13 ana parçayı içerir (talimattaki liste); yeni parça `src/lib/body-parts.ts` + şema çiziminde eklenir.

## Değişen dosyalar (özet)

- Veri: `prisma/schema.prisma`, yeni migration, `prisma/seed.ts`
- Yeni: `src/lib/body-parts.ts`, `body-parts-db.ts`, `vehicle-filters.ts`, `listing-rules.ts`, `media-access.ts`, `src/components/BodyDiagram.tsx`, `src/components/crm/BodyPartsEditor.tsx`, `src/app/api/crm/vehicles/[id]/parts/route.ts`, `scripts/sifre-belirle.ts`, `tests/filters-parts.test.ts`, `public/brand/*`, `src/app/icon.png`, `apple-icon.png`
- Güncellenen: medya rotası, foto/video/araç API'leri, AI taslak rotası, CRM araç sayfası ve formu, AI akışı, müşteri listeleme / detay / ana sayfa, filtre paneli, kart, galeri, site çerçevesi, tema, `tests/e2e-demo.mjs`, belgeler (`README`, `BURAK_KURULUM`, `BURAK_DEVIR`, `VERCEL_DEPLOY`, `DEMO_SCRIPT`, `.env.example`)

## Burak'ın kendi canlı demosu (22.10.2026)

- Adres: **https://mirmotors-demo-burak.vercel.app** (Vercel Hobby, ekip `fbm8`, proje `mirmotors-demo-burak`, bölge fra1)
- Veritabanı: Neon (`mirmotors-db-burak`, Frankfurt) · Dosyalar: Vercel Blob özel mağaza (`mirmotors-media-burak`, fra1)
- Yayın: proje klasöründen `vercel deploy --prod` (GitHub otomatik dağıtımı bağlı değil). Migration derlemede `prisma migrate deploy` ile uygulanır.
- Gizli değerler (erişim kapısı, oturum anahtarı, 3 personel şifresi): `.env.vercel-secrets.local` (git dışında). Muhammed'in canlı demosu (`mirmotors-demo.vercel.app`) ayrıdır ve değiştirilmedi.
- Canlı E2E (Blob doğrudan yükleme ile): **126/126** geçti. Testin oluşturduğu araçlar, satış/geçmiş kayıtları ve Blob dosyaları ardından silindi; veritabanında yalnızca 11 örnek araç kaldı.

## Ek: Belgeden araç ekleme ve düzeltmeler (23.10.2026)

- **Belgeden ekle (ruhsat + ekspertiz):** CRM → Yeni araç → "Belgeden ekle". Fotoğraflar özel depolamaya kaydedilir (yalnızca CRM, konum bilgisi silinir), OpenAI görüntü modeli (`gpt-5.5`, `OPENAI_VISION_MODEL` ile değiştirilebilir) her belgeyi **ayrı** okur; birleştirme, şasi son 6 hane, yakıt/vites eşlemesi, kW→hp ve **belgeler aynı araca mı** kontrolü kodda yapılır (`src/lib/ai/document-sanitize.ts`). Plaka/şasi uyuşmazsa ekspertiz bilgileri aktarılmaz, çelişki kırmızı gösterilir. Kişisel veriler (ad, TC, adres) okunmaz; 11 haneli diziler maskelenir.
- Ekspertizden okunan parça durumları şemanın **ekspertiz raporu** tarafına yazılır; personel araç sayfasında "personel beyanına aktar" ile tek tıkla onaylar. Araç sayfasında "Belgeler" bölümü.
- Gerçek okuma testi (kullanıcının örnek belgeleri): ekspertizde km, tarih, plaka, şasi son 6, yakıt, vites, bagaj kapağı lokal boya ve sağ arka çamurluk boyalı doğru okundu; "plastik" parçalar Bilinmiyor bırakıldı. Farklı araçlara ait ruhsat + ekspertiz birlikte verildiğinde çelişki doğru yakalandı. Düşük çözünürlüklü ruhsatta plakada bir harf eksik okundu → personel kontrolü zorunlu. Süre ~60 sn.
- Düzeltmeler: Vercel'de (Blob) fotoğraflar da sunucuda küçültülüp konum bilgisi siliniyor; mobilde şemaya dokununca parça adı kalıcı görünüyor; fotoğraf sırası = kapak (CRM'deki 1 numara sitede ilk); Türkçe 404 sayfası; çalışma saatleri tutarlı; CRM özetinde markasız taslak; "Tescil" ilan bilgilerinde; şeffaf PNG beyaz zemin; filtre panelinde geri tuşu; AI'dan gelen liste dışı çekiş değeri.
- Testler: birim **20/20**, yerel E2E **129/129**.

## Ek: Belgelerden AI ile araç oluşturma V1.2 (23.10.2026)

**Akış:** CRM → Yeni araç → 4 belge yöntemi (yalnız ruhsat · ruhsat + ekspertiz · yalnız ekspertiz · mevcut araca belge ekle) veya elle giriş. Belgeler yüklenir (çoklu dosya, JPG/PNG/WEBP, PDF en fazla 6 sayfa, iPhone HEIC) → **her sayfada kişisel veriler tarayıcıda kapatılır** (maskelenmemiş görüntü sunucuya hiç gitmez) → analiz arka planda çalışır (Yüklendi → Okunuyor → Karşılaştırılıyor → Kontrol Bekliyor; iptal / yeniden dene; sayfa kapansa da `?analiz=` ile devam) → araç **"Kontrol Bekliyor"** durumunda oluşur.

- **İnceleme paneli** (araç sayfası): A · belgede bulunanlar (belge, sayfa, konum, okunan metin ile), B · eksik/belirsiz alanlar ve nedeni ("ekspertizde tramer yok ≠ tramer yok"), C · çelişkiler (personel kaynağı seçer). Aynı araç kararı: tam şasi → kısmi şasi (son 6) → plaka → marka/model. Yalnızca plaka farkı "farklı araç" sayılmaz, personele sorulur; şasi uyuşmazlığında ekspertiz aktarılmaz ve "ekspertizi ayır" seçeneği çıkar. Stokta aynı plaka/şasi varsa uyarı; aynı dosya ikinci kez yüklenemez (SHA-256).
- **Kaporta:** belirsiz/plastik parça "Bilinmiyor" kalır; lejant (renk/harf) eşlenir; rapordaki değer parça parça veya toplu alınır; **personelin girdiği değer asla ezilmez**. Mevcut araca belge eklenince yalnızca boş alanlar dolar, farklar çelişki olarak gösterilir.
- **Yayın kontrolü:** Kontrol Bekliyor araç yayımlanamaz; eşleşme onayı, tescil sahibi kontrolü, çelişkiler ve "AI bilgilerini kontrol ettim" onayı olmadan "Kontrolü tamamla" çalışmaz.
- **Kalite:** sunucuda çözünürlük, karanlık ve bulanıklık ölçülür; AI kesik kenar/parlama bildirir; uyarılar belgede ve panelde görünür.
- **Güvenlik/KVKK:** belgeler yalnızca CRM'de, özel depolamada; yükleme, analiz, görüntüleme, bağlama, ayırma ve silme denetim kaydına (DocumentAudit) yazılır. T.C./vergi no benzeri diziler sonuçtan silinir; şasinin yalnızca son 6 hanesi saklanır ve etiketi "(E) Şase/VIN" değilse kabul edilmez.
- **Maliyet sınırı:** günlük canlı analiz sınırı (`OPENAI_DAILY_ANALYSIS_LIMIT`, varsayılan 40), sayfa sınırı (8, ruhsat 2), en fazla 3 deneme, 6 dakikada takılan iş hata sayılır. Her analizin token ve USD maliyeti kaydedilir.

**Gerçek AI testi (gpt-5.5, yalnızca sentetik "ÖRNEK – TEST" belgeler, 9 senaryo):** aynı/farklı araç kararı 9/9 doğru; alanlar 82/83 (tek fark: beklenen boş kalacak alan doğru okundu); kaporta parçaları 52/52 (plastik parçalar Bilinmiyor bırakıldı, harf lejantı doğru, 2. sayfadaki tramer 12.500 bulundu, tramersiz raporda tramer uydurulmadı); kişisel veri sızıntısı 0. 500 px'lik ruhsatta şasi okunamadı olarak bırakıldı (doğru davranış). Süre/maliyet: ruhsat ~15–28 sn (~0,06–0,08 $), ekspertiz ~16–20 sn (~0,08–0,11 $), ikisi ~33–40 sn (~0,14–0,16 $).

**Testler:** lint ✓ · TypeScript ✓ · build ✓ · birim **31/31** · yerel E2E **139/139** (belge bölümü 16 kontrol). Tarayıcıda PDF → sayfa → maskeleme → analiz → Kontrol Bekliyor akışı elle denendi.

**Bilinen sınırlamalar:** HEIC dönüşümü otomatik test edilemedi (iPhone fotoğrafıyla denenmeli). Bulanıklık eşikleri sentetik belgelerle ayarlandı, gerçek galeri fotoğraflarıyla gözden geçirilmeli. Gerçek müşteri belgeleriyle test yapılmadı. Canlı (Vercel) sürüme bu sürüm henüz yüklenmedi; yükleme `20261023120000_belge_analizi_v12` migration'ını uygular (yalnızca ekleme yapar, veri silmez).
