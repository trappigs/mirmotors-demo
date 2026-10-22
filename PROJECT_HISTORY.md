# Mir Motors — Proje Geçmişi

> **Bu belge nasıl hazırlandı?** Bu özet; Claude Code ile yürütülen geliştirme oturumundaki görev tanımlarından,
> Git commit geçmişinden ve depodaki `DECISIONS.md`, `STATUS.md`, `VERCEL_DEPLOY.md` dosyalarından derlenmiştir.
> **Proje sahibinin ChatGPT'deki (veya başka bir araçtaki) sohbet geçmişine erişim yoktur**; o sohbetlerde alınmış
> ama buraya yansımamış kararlar olabilir. Bu belge bir sohbet dökümü değil, bir özettir. Tam sohbet dökümü gerekiyorsa
> proje sahibi ayrıca paylaşmalıdır.

## 1. Projenin amacı

Mir Motors (ikinci el araç galerisi) için iki ürün:

1. **Kurumsal araç satış web sitesi** — Borz Motor'un araç listeleme deneyimini örnek alan, müşterilerin stoktaki
   araçları arayıp filtreleyebildiği ve detaylarını görebildiği site.
2. **Galeri CRM'i** — çalışanların araç, stok, opsiyon ve satış işlemlerini yönettiği, AI destekli araç girişi
   hedeflenen personel paneli.

İkisi aynı Next.js uygulamasındadır: müşteri sitesi `/`, CRM `/crm`.

Şu anki sistem **demo/prototiptir**; müşteri kullanımına açılmış bir üretim sistemi değildir.

## 2. Kronoloji

Tüm geliştirme 22.10.2026 tarihinde, art arda verilen görevlerle yapıldı (saatler commit saatleridir).

| Saat | Aşama | Ne yapıldı | Commit |
|---|---|---|---|
| 01:06–01:34 | **Çalışan demo (MVP)** | Boş klasörden Next.js 15 + Prisma + SQLite. Müşteri sitesi, CRM, personel girişi, 14 adımlık demo senaryosu: BMW ekle → fotoğraf yükle → yayımla → müşteri bulur/filtreler → Ahmet opsiyonlar → Mehmet engellenir → noter onayıyla satış → ilan kalkar. AI ile video girişi (API anahtarı yoksa simülasyon). | `0602b00` |
| 01:39–02:02 | **Güvenlik sıkılaştırma** | Opsiyon sahipliği kuralları, giriş denemesi sınırı (birkaç tasarım denemesinden sonra hesap bazlı sayaç), taslak videonun tek araca bağlanması, sabit seed kimlikleri, yedek sunum materyali. | `b84b481` … `4959177` |
| 02:45 | **Görsel cila** | Premium görünüm, CRM'de hafif düzenleme. | `3226e4e` |
| 03:49 | **Borz Motor düzeni** | Araç listeleme ve ana sayfa Borz Motor'un `/tum-araclar` yerleşimine uyarlandı (geniş arama, hızlı filtre etiketleri, detaylı filtre paneli, ızgara/liste). | `2422ac1` |
| 04:20 | **Kırmızı-beyaz-siyah tema** | Önceki koyu/altın yön iptal edildi; Borz referanslı kırmızı tema (#BA1020). | `ecaed54` |
| 04:46 | **Gerçek demo fotoğrafları** | Unsplash License fotoğrafları; plakalar bulanık, "TEMSİLİ GÖRSEL · DEMO" etiketli. | `ab9751c` |
| 05:13 | **Story + Hero Slider** | Instagram benzeri story şeridi (yerel veriden), 3 slaytlı otomatik hero slider, slider altında arama kartı. | `e026912` |
| 05:33–06:07 | **Vercel ücretsiz demo** | Ayrı `vercel-deploy` dalı: SQLite → Neon PostgreSQL, dosyalar → Vercel Blob (özel mağaza), CRM erişim kapısı, sıfırlama korumaları. Canlı: https://mirmotors-demo.vercel.app | `787c9ed` … `c96062e` |
| sonrası | **Proje devri** | Bu belge, `BURAK_DEVIR.md`, `BURAK_KURULUM.md`, `ROADMAP_BURAK.md`, `CLAUDE.md`, teslim ZIP'i. | (devir commit'i) |

## 3. Alınan önemli kararlar

### Ürün ve iş kuralları

| Karar | Koddaki karşılığı |
|---|---|
| Araçlar **manuel** veya **AI video analiziyle** eklenebilir. | `/crm/vehicles/new` → "Manuel giriş" / "AI ile video" |
| Fotoğrafları **çalışanlar manuel yükler**; AI'ın videodan çıkardığı kareler ilan fotoğrafı olarak kullanılmaz. | `MediaManager`, `src/lib/ai/frames.ts` (yalnızca AI bağlamı) |
| **Fotoğraf olmadan ilan yayımlanamaz** (sunucu kuralı). | `src/lib/vehicle-status.ts` (publish) |
| Video yüklenirse müşterinin araç detayında oynatılır. | `src/app/(site)/araclar/[id]/page.tsx` |
| Opsiyonlu araçlar sitede **"Opsiyonlu"** etiketiyle görünmeye devam eder. | `PUBLIC_STATUSES = AVAILABLE, OPTIONED` |
| **Satış bekleyen** araçlar müşterilerden gizlenir. | `SALE_PENDING` sitede listelenmez, detayı 404 |
| **Satılan** aracın ilanı gecikmeden kaldırılır; CRM'de satış geçmişi korunur. | `force-dynamic` + `revalidatePath`, `Sale` + `StatusHistory` |
| Aynı araçta **çakışan personel işlemleri engellenir** — yalnızca buton gizleyerek değil, veritabanında koşullu güncellemeyle. | `UPDATE ... WHERE id AND status [AND optionedById]` (birim testinde eşzamanlılık doğrulandı) |
| Satış tamamlamak için **noter devri onayı** zorunlu. | `completeSale` → `notaryCompleted` |
| **Online ödeme veya kapora yok.** | Kodda ödeme yok |
| Web sitesi **Borz Motor'un araç listeleme deneyimini** örnek alır; Borz'un logo, metin, fotoğraf ve taksit/kredi/senetli/konsinye/nakit alım içerikleri kopyalanmaz. | `src/components/site/*` |
| **Kırmızı, beyaz ve siyah** tema. | `src/app/globals.css` `@theme` |
| **Story şeridi ve otomatik Hero Slider**; story içeriği yalnızca yayındaki araçlardan üretilir, uydurma teslimat/yorum/kampanya yok. | `src/lib/home-stories.ts`, `HeroSlider.tsx` |
| **WhatsApp stok botu** ve **Instagram DM entegrasyonu** sonraki aşamalara bırakıldı. Sitede yalnızca `wa.me` bağlantısı var. | — |
| Demo ibaresi her sayfada, arama motoru indekslemesi kapalı (`noindex`). | `SiteChrome`, `next.config.ts`, `robots.ts` |
| Plaka, şasi no, yetki belgesi no **uydurulmaz**; alanlar veri modelinde boş bırakılabilir. | `legal*` alanları |

### Teknik kararlar (özet; ayrıntı `DECISIONS.md`)

- Tek uygulama: Next.js 15 App Router + TypeScript + Tailwind 4 + Prisma 6.
- Kendi oturum sistemi (jose ile imzalı httpOnly çerez + bcrypt); iki rol: Yönetici, Satış Personeli.
- Yerel sürüm SQLite (`master`), Vercel sürümü Neon PostgreSQL (`vercel-deploy`).
- Vercel'de dosyalar özel Vercel Blob mağazasında; tarayıcıdan doğrudan yüklenir, sunucu dosya imzası ve boyutu doğrular.
- Ekspertiz PDF'leri müşteriye açık değil; yalnızca oturumlu personel görür.
- Vercel'de CRM ek bir erişim şifresi (HTTP Basic) ile korunur; yerel sabit demo şifresi bulutta geçersiz.
- Veriyi sıfırlayan komutlar yalnızca yerel (localhost) veritabanında çalışır.

## 4. AI'ın mevcut durumu

- **Var olan:** AI ile video yükleme arayüzü, taslak formu, insan onayı zorunluluğu (fiyat / boya-değişen-hasar / ekspertiz
  onay kutuları), **Simülasyon Modu** (sabit örnek transkript ve çıktı; ekranda "canlı AI analizi değildir" yazar).
- **Yazılmış ama doğrulanmamış:** Claude (yapılandırılmış çıktı) + Whisper (konuşma → metin) + ffmpeg (kare çıkarma) ile
  canlı analiz kodu. **Gerçek API anahtarlarıyla hiç test edilmedi**; canlı ortamda çalıştığı doğrulanmadı.
- **Vercel sürümünde** canlı AI kapalıdır (kare çıkarma yerel dosya gerektirir); her zaman simülasyon.
- Bu özellik **tamamlanmış sayılmamalıdır**.

## 5. Hukuki durum (netleşmemiş konular)

- **EİDS** (Elektronik İlan Doğrulama Sistemi) gerekliliği kesinleşmedi.
- Mir Motors'un yalnızca **kendi adına tescilli araçlarını** kendi sitesinde listelemesi planlanıyor.
- Sosyal medya paylaşımlarında **EİDS doğrulanmış ilan bağlantısı** konusu netleştirilmeli.
- İlanlarda **zorunlu bilgiler** (yetki belgesi no vb.), **KVKK** (aydınlatma metni, çerez, WhatsApp verileri) ve
  **şirket bilgilerinin** (ticari unvan, MERSİS, adres) gösterimi kontrol edilmeli.
- Ekspertiz raporlarının müşteriye açılması için rapor sahibi kurumun izni gerekebilir.
- Şu anki sistem **demo**dur; gerçek müşteri verisi içermez ve üretim kullanımına açılmamıştır.

## 6. Bilinçli olarak ertelenenler

WhatsApp stok botu, Instagram DM asistanı, otomatik müşteri cevaplama, EİDS entegrasyonu, online ödeme/kapora,
muhasebe/DMS, AI ekspertiz PDF analizi, otomatik opsiyon süresi, üçüncü parti ilan senkronizasyonu, müşteri (lead) CRM'i,
kullanıcı yönetimi ekranı, şifre değiştirme, ek filtreler (renk, donanım, boya/değişen…), fotoğraf sıralama.

## 7. Bağlantılar

- Canlı demo: https://mirmotors-demo.vercel.app (CRM ek erişim şifresi ister; şifreler proje sahibinden alınır)
- Miro akış diyagramı: https://miro.com/app/board/uXjVEXcXXrM=/ (bu belgeyi hazırlarken içeriği incelenmedi)
- Teknik ayrıntı: `BURAK_DEVIR.md` · Kurulum: `BURAK_KURULUM.md` · Yol haritası: `ROADMAP_BURAK.md`
