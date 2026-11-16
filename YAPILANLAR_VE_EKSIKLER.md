# Mir Motors — Yapılanlar ve Eksikler (Burak için, 22.10.2026)

Bu belge; Muhammed'in hazırladığı tüm `.md` dosyaları (README, BURAK_DEVIR, BURAK_KURULUM, PROJECT_HISTORY, ROADMAP_BURAK,
DECISIONS, STATUS, VERCEL_DEPLOY, DEMO_SCRIPT, CLAUDE, public/demo-cars/CREDITS), kodun satır satır denetimi ve bu bilgisayarda
bugün çalıştırılan testlerden derlendi. Belgede "eksik" denip kodla doğrulananlar ile belgelerde **hiç yazmayan** yeni bulgular
ayrı ayrı işaretlendi.

## 1. Elindeki paketler

| Dosya | İçerik | Sonuç |
|---|---|---|
| `Masaüstü\MIR_MOTORS_BURAK_TESLIM.zip` | Kod + belgeler + tam git geçmişi (`mirmotors-git-gecmisi.bundle`) | `Masaüstü\Mir Motors Demo\` içine açıldı, git geçmişi bağlandı |
| `İndirilenler\mirmotors-demo-vercel-deploy.zip` | GitHub'dan indirilen `vercel-deploy` dalı | Teslim paketiyle **birebir aynı** (aynı commit `f90358b`, 154 dosyanın hepsi aynı) |

- Dallar: `vercel-deploy` (güncel, PostgreSQL + Vercel Blob) ve `master` (ilk SQLite sürümü, arşiv). `master`'da olup `vercel-deploy`'da olmayan commit yok.
- 20 commit, hepsi 22.10.2026 gecesi (01:06–06:43).

## 2. Bugün bu bilgisayarda doğrulananlar

| Kontrol | Sonuç |
|---|---|
| `npm ci` (554 paket) | Geçti |
| Yerel veritabanı (`npx prisma dev`, port 51214) + migration + örnek veri | Geçti (3 personel, 11 araç) |
| `npm run lint` | Geçti, uyarı yok |
| `npm run build` | Geçti |
| Birim testleri (`npm test`, ayrı test veritabanı port 51218) | **7/7 geçti** |
| E2E senaryosu (`npm run e2e`) | **65/65 geçti** (giriş, taslak, fotoğraf/video/PDF, yayın, 21 filtre, opsiyon, Mehmet engeli, noter onaylı satış, 404, eşzamanlılık) |
| Canlı site (mirmotors-demo.vercel.app) | Ana sayfa, araçlar, Hakkımızda açılıyor (200); CRM erişim şifresi istiyor (401) |

E2E sonrası `npm run db:reset` ile örnek veri baştan yüklendi.

## 3. Yapılanlar (kodla doğrulandı)

**Müşteri sitesi**
- Ana sayfa (story şeridi, 3 slaytlı otomatik hero slider, arama kartı), Araçlarımız, Araç detayı, Hakkımızda, İletişim; mobil uyumlu.
- Listeleme: ızgara/liste, 5 sıralama, "Opsiyonlu" etiketi; yalnızca satışta + opsiyonlu araçlar görünür, satış bekleyen/satılan araç 404.
- Filtreler: metin araması (marka/model/paket, büyük/küçük harf duyarsız), marka→model, fiyat, yıl, km, yakıt, vites, kasa, durum, hızlı etiketler.
- Detay: galeri, video (ileri-geri sarma destekli), özellikler, donanım, boya/değişen/hasar/tramer, ekspertiz özeti, WhatsApp bağlantısı.
- Her sayfada DEMO bandı, `noindex` (başlık + meta + robots.txt).

**CRM**
- Personel girişi (Yönetici / Satış), imzalı httpOnly çerez, hesap başına 15 dk'da 10 hatalı deneme sınırı (veritabanında).
- Özet ekranı, araç listesi (durum sekmeleri + arama), manuel araç ekleme (her zaman taslak), düzenleme.
- Fotoğraf yükleme/silme/kapak, video yükleme/silme, ekspertiz PDF yükleme (yalnızca personel görür); dosya imzası + boyut kontrolü.
- Durum makinesi: yayımla (en az 1 fotoğraf), opsiyonla, opsiyon kaldır, satış başlat, noter onayıyla tamamla, yönetici iptali, yayından al.
  Tüm geçişler veritabanında koşullu ve atomik; aynı anda iki istekten yalnızca biri geçer.
- Opsiyon sahipliği: opsiyonlu araçta bilgi/medya değişikliği yalnızca opsiyon sahibi veya yönetici.
- İşlem geçmişi ve satış kayıtları korunuyor.
- AI ile video girişi: arayüz + **Simülasyon Modu** (sabit örnek çıktı, ekranda açıkça yazıyor). Fiyat/hasar/ekspertiz onayı olmadan kayıt alınmıyor.

**Altyapı**
- Next.js 15.5, React 19, Prisma 6, PostgreSQL (Neon), Vercel Blob (özel mağaza), Tailwind 4.
- Vercel'de canlı: CRM'e HTTP Basic erişim kapısı (şifre tanımlı değilse CRM 503 ile kapanır).
- Veri silen komutlar (`setup`, `demo`, `db:reset`) yalnızca localhost veritabanında çalışır.

## 4. Eksikler

### 4.1 Gerçek kullanımdan önce mutlaka çözülmesi gerekenler

| # | Konu | Neden önemli | Yer | Belgede var mı? |
|---|---|---|---|---|
| 1 | **Üç personel hesabı aynı şifreyi kullanıyor** (yerelde de bulutta da). Satış personeli yönetici şifresini biliyor, rol ayrımı fiilen yok. Şifre değiştirme ekranı da yok. | Güvenlik | `prisma/seed.ts:57,77-80` | **Yok — yeni bulgu** |
| 2 | **`/media` araç durumuna bakmıyor**: taslak, satış bekleyen, satılmış araçların foto/videoları ve AI taslak videoları adresi bilen herkese açık. Vercel'de silinen fotoğraf CDN'de 1 yıla kadar önbellekte kalabilir (`s-maxage=31536000`). | Plakası görünen bir fotoğrafı silsen bile yayında kalabilir | `src/app/media/[...path]/route.ts:6-15` | **Yok — yeni bulgu** |
| 3 | **AI ile yüklenen anlatım videosu, ilanın herkese açık "Tanıtım videosu" oluyor.** Personelin sesi, hasar/tramer konuşması ilanda yayınlanır. | KVKK + ürün kararı | `src/app/api/crm/vehicles/route.ts:25`, `src/app/(site)/araclar/[id]/page.tsx:118-122` | **Yok — yeni bulgu** |
| 4 | **Yasal ilan alanları yayımlamada zorunlu değil ve sitede hiç gösterilmiyor.** Yayımlama yalnızca marka/model/yıl/fiyata bakıyor. Sitedeki "İlan no" yasal ilan no değil, araç kimliğinin son 6 karakteri. | Mevzuat (aşağıdaki tablo) | `src/lib/vehicle-status.ts:69`, `araclar/[id]/page.tsx:33,89` | Kısmen ("gösterim kuralı belirlenmedi") |
| 5 | **Şirket bilgileri, KVKK aydınlatma metni, çerez politikası, iletişim formu yok.** Hakkımızda/İletişim temsilî metin; adres yer tutucu. | Mevzuat | `src/app/(site)/hakkimizda`, `iletisim`, `SiteChrome.tsx` | Evet (hukuki inceleme olarak) |
| 6 | **Hesap/erişim devri tamamlanmadı**: GitHub özel deposuna davet yok, Vercel ekibine ekleme yok, Neon/Blob hesapları Muhammed'de, canlı erişim şifresi ve canlı personel şifreleri sende değil. | Canlıya deploy edemezsin | — | Evet |

**Yasal ilan alanlarının durumu**

| Bilgi | Veri modelinde | CRM formunda | Sitede | Yayında zorunlu |
|---|---|---|---|---|
| Yetki belgesi no | Var (`legalAuthorizationNo`) | Var | Yok | Hayır |
| Ticari unvan / MERSİS / adres | **Yok** | Yok | Yok (yalnızca logo) | — |
| İlan no | Var (`legalListingNo`) | Var | Yok (yerine kimlik son 6 hane) | Hayır |
| Marka / model / yıl / yakıt / km / fiyat | Var | Zorunlu | Var | Evet |
| Şasi no (son 6 hane) | Var (tam numara, `legalVin`) | Var | Yok, maskeleme kodu yok | Hayır |
| Plaka | Var (`legalPlate`) | Var | Yok | Hayır |
| Boya / değişen, hasar, tramer | Var | Var | Var | Hayır |
| Rehin / haciz | **Yok** | Yok | Yok | — |
| Kalan garanti | **Yok** | Yok | Yok | — |
| Tescil sahibi | **Yok** (yalnızca "sahibinden ilan izni" onay kutusu) | Onay kutusu | Yok | Hayır |

### 4.2 Muhammed'in belgelerinde "yapılmadı" denen ve kodla doğrulanan eksikler

| Konu | Not |
|---|---|
| Kullanıcı yönetimi, şifre değiştirme | Kullanıcılar yalnızca seed ile oluşuyor (3 sabit hesap). 4.1/1 ile birlikte ele alınmalı. |
| Ek filtreler | Renk, donanım, boya/değişen, hasar/tramer, motor gücü, çekiş yok (veri var, arayüz yok). Paket yalnızca metin aramasında. |
| Fotoğraf sıralama | Yalnızca kapak seçimi var. |
| Otomatik opsiyon süresi | `optionedAt` kaydediliyor ama zamanlanmış iş yok. |
| Müşteri (lead) CRM'i | Müşteri modeli yok; satış kaydında **alıcı bilgisi de yok**. |
| Araç silme / arşivleme | Yok; canlıdaki 2 test satışı arayüzden silinemez. |
| Görsel yeniden boyutlandırma, video dönüştürme | Dosyalar olduğu gibi kaydediliyor; `.mov` bazı tarayıcılarda oynamaz. |
| Yarım kalan Blob yüklemelerinin temizliği | Yok. |
| Gerçek AI | Kod yazılmış (model `claude-opus-5-5` + Whisper + ffmpeg) ama **hiç gerçek anahtarla denenmedi**; Vercel'de çalışması için kod değişikliği gerekiyor (videoyu Blob'dan geçici dosyaya indirme). Whisper'a giden istekte zaman aşımı/maliyet sınırı yok. |
| Bilinçli ertelenenler | WhatsApp stok botu, Instagram DM, EİDS, online ödeme/kapora, muhasebe, satış raporları. |

### 4.3 Küçük hatalar ve iyileştirmeler (belgelerde yok)

| Konu | Yer |
|---|---|
| CRM araç araması büyük/küçük harfe duyarlı ("bmw" yazınca "BMW" bulunmuyor); müşteri sitesinde düzeltilmiş, CRM'de unutulmuş | `src/app/crm/(panel)/vehicles/page.tsx:13` |
| Bilinmeyen adreslerde Next.js'in İngilizce varsayılan 404 sayfası çıkıyor, DEMO bandı yok (kökte `not-found.tsx` / `error.tsx` yok) | `src/app/` |
| Ekspertiz PDF'ini silme düğmesi yok (API'de var, arayüzde yalnızca "değiştir") | `src/components/crm/MediaManager.tsx:141-161` |
| Durum geçişi rotası her hatayı "eşzamanlı işlem" (409) diye gösteriyor; veritabanı kesintisi yanlış mesajla gizlenir | `src/app/api/crm/vehicles/[id]/transition/route.ts:27-31` |
| Fotoğraf/video/PDF değişiklikleri işlem geçmişine yazılmıyor | medya rotaları |
| Çıkış yapınca oturum jetonu iptal edilmiyor (12 saat geçerli kalıyor) | `src/app/api/auth/logout/route.ts` |
| CSRF için yalnızca SameSite=Lax çerez var; Origin kontrolü yok | `src/lib/session.ts:36` |
| Güvenlik başlıkları (CSP, HSTS) yok | `next.config.ts` |
| Sayfalama yok (site ve CRM tüm araçları tek seferde çekiyor) | `public-vehicles.ts`, CRM listesi |
| "Araç ekle" ekranındaki AI durum etiketi Vercel ortamını hesaba katmıyor (anahtar eklenirse "Canlı AI" yazar ama simülasyona düşer) | `src/app/crm/(panel)/vehicles/new/page.tsx:17` |
| Sabit metinler: çalışma saatleri "demo" etiketsiz; "demo numarasıdır" yazısı gerçek numara girilse de kalır; "Showroom ziyareti planla" formu olmayan İletişim'e gidiyor | `iletisim/page.tsx`, `SiteChrome.tsx`, `araclar/[id]/page.tsx:229` |
| SEO: sitemap, Open Graph, yapılandırılmış veri yok (demo için bilinçli; yayında gerekir) | — |
| Testler yalnızca durum makinesini kapsıyor; yetki, giriş sınırı, dosya imzası için birim testi yok | `tests/` |
| `npm audit`: 10 açık (1 orta, 9 yüksek), hepsi Next/Prisma/ESLint araç zincirinde; çözümleri büyük sürüm yükseltmesi (Next 16, Prisma 7) | `package.json` |

### 4.4 Muhammed'in belgelerinde düzeltilmesi gereken yerler

- STATUS.md ve DECISIONS.md giriş sayacını "bellek içi" diye anlatıyor; bu dalda sayaç veritabanında.
- DECISIONS.md "seed fotoğrafları `storage/public/seed/`'e kopyalanır" diyor; bu dalda `/demo-cars/` statik yolu kullanılıyor.
- BURAK_DEVIR.md "satış bekleyen araç düzenlenemez" diyor; bu yalnızca form için doğru, medya değiştirilebiliyor (DECISIONS.md:41 doğru).
- BURAK_DEVIR.md §13 filtre satırında motor gücü, çekiş, hasar filtrelerinin eksikliği sayılmamış.
- STATUS.md "DEMO bandı 404 dahil her sayfada" diyor; bu yalnızca araç detayının 404'ü için doğru, genel 404'te bant yok.

## 5. Önerilen çalışma sırası

1. **Erişim devri:** GitHub kullanıcı adını Muhammed'e gönder; Vercel ekibine eklenmeyi, canlı şifreleri ve Neon/Blob erişimini iste.
2. **Güvenlik hızlı düzeltmeleri:** personel başına ayrı şifre + şifre değiştirme/kullanıcı yönetimi ekranı; `/media`'ya durum kontrolü ve kısa CDN önbelleği; AI anlatım videosunun ilana otomatik bağlanmaması.
3. **Mevzuat alanları:** şirket bilgileri (unvan, MERSİS, adres, yetki belgesi no), eksik ilan alanları (rehin/haciz, kalan garanti, tescil sahibi), şasi son 6 hane maskeleme, yayımlamada zorunlu alan kontrolü, KVKK aydınlatma + çerez sayfaları.
4. **Gerçek veriye geçiş:** galerinin kendi araçları ve fotoğrafları, Hakkımızda/İletişim gerçek içerik, gerçek WhatsApp numarası.
5. **Eksik özellikler:** ek filtreler, fotoğraf sıralama, araç arşivleme, müşteri/alıcı kaydı, otomatik opsiyon süresi, küçük hatalar (4.3).
6. **Gerçek AI ve otomasyon:** AI canlı yol testi, sonra WhatsApp/Instagram.

## 6. Yerel ortam (bu bilgisayar)

- Proje: `C:\Users\burak\Desktop\Mir Motors Demo\mirmotors` (dal `vercel-deploy`)
- Veritabanı: `npx prisma dev --name mirmotors` (port 51214) · test veritabanı `mirmotors-test` (port 51218)
- Çalıştırma: `npm start` (derlenmiş) veya `npm run dev` → http://localhost:3000, CRM http://localhost:3000/crm
- Dikkat: `npm run setup` / `npm run demo` / `npm run db:reset` tüm veriyi siler.
