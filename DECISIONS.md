# Teknik Kararlar

## Altyapı

| Karar | Gerekçe |
|---|---|
| Proje klasörü boştu → Next.js 15 (App Router) + TypeScript + Tailwind 4 | Site, CRM ve API tek uygulamada; tek komutla çalışır; mikroservis/Docker gerekmez. |
| Prisma 6 + SQLite | Yerel demo için kurulum gerektirmez. Prisma 7'nin yeni yapılandırma modeli yerine olgun 6.x seçildi. Üretimde PostgreSQL'e geçiş yalnızca `provider` değişikliği + migration gerektirir. |
| Durumlar `String` alan (enum değil) | SQLite uyumluluğu; geçerli değerler `src/lib/constants.ts` ve zod ile sunucuda denetlenir. |
| Kendi oturum sistemi: jose ile HS256 imzalı httpOnly çerez + bcrypt | 2 rol için harici kimlik sağlayıcı gereksiz. Middleware `/crm` ve `/api/crm` yollarını korur; **her API rotası ayrıca** `requireApiUser()` ile kullanıcıyı veritabanından doğrular. |
| Dosyalar `storage/` altında, Next `public/` dışında | `next start` sonrası yüklenen dosyalar `public/`'ten servis edilmez. Fotoğraf/video `/media/...` rotasıyla (HTTP Range destekli, video sarma için), ekspertiz PDF'leri yalnızca oturumlu `/api/crm/files/...` rotasıyla servis edilir. |
| Yükleme doğrulaması: uzantı + boyut + dosya imzası (magic bytes) | MIME başlığına güvenilmez. Fotoğraf 10 MB, video 200 MB, PDF 15 MB. Dosya adları rastgele UUID; yol dışına çıkma engelli. |
| `middlewareClientMaxBodySize: 250mb` | Next 15 middleware'i varsayılan 10 MB'ta gövdeyi kesiyordu; büyük video yüklemeleri için yükseltildi. |
| Müşteri sayfaları `force-dynamic` + geçişlerde `revalidatePath` | Önbellek yok; satılan/satış bekleyen araç bir sonraki istekte anında kaybolur. |
| Satılmış/satış bekleyen aracın detay bağlantısı HTTP 404 + "Bu ilan artık yayında değil" | Eski bağlantı aktif ilan göstermez; arama motorları için de doğru sinyal. |
| Tüm sayfalarda `X-Robots-Tag: noindex`, `robots.txt` Disallow, meta robots noindex | Demo ilanları indekslenmez. |

## Opsiyon ve satış kuralları (sunucu tarafı)

Durum makinesi: `src/lib/vehicle-status.ts`. Her geçiş tek bir veritabanı işleminde **koşullu güncelleme** (`UPDATE ... WHERE id=? AND status=? [AND optionedById=?]`) ile yapılır; etkilenen satır 1 değilse işlem reddedilir. Aynı anda gelen iki istekten yalnızca biri başarılı olur (birim testinde ve E2E testinde doğrulandı).

| Geçiş | Kim | Not |
|---|---|---|
| DRAFT → AVAILABLE (yayımla) | Tüm personel | En az 1 yüklenmiş fotoğraf + marka/model/yıl/fiyat zorunlu |
| AVAILABLE → DRAFT (yayından al) | Yönetici | |
| AVAILABLE → OPTIONED | Tüm personel | Opsiyon sahibi kaydedilir |
| OPTIONED → AVAILABLE (opsiyon kaldır) | Yönetici veya opsiyon sahibi | Karar: opsiyon sahibinin kendi opsiyonunu bırakabilmesi makul bulundu |
| OPTIONED → SALE_PENDING | Opsiyon sahibi veya yönetici | Satış kaydı (Sale) açılır |
| SALE_PENDING → SOLD | Satışı başlatan çalışan veya yönetici | "Noter devri tamamlandı" onayı zorunlu; noter tarihi kaydedilir |
| SALE_PENDING → AVAILABLE (satış iptali) | Yönetici | Sale kaydı silinmez, `cancelledAt` ile korunur |
| SOLD → * | Hiç kimse | Satılmış araç normal işlemlerle geri açılamaz, düzenlenemez, medyası silinemez |

- Satış bekleyen ve satılmış araçların bilgileri düzenlenemez (satış kaydının bütünlüğü).
- Her durum değişikliği `StatusHistory` tablosuna personel, tarih, önceki ve sonraki durumla yazılır; düzenlemeler de "Düzenlendi" olarak loglanır.
- Butonlar yol göstericidir; Mehmet'e "Satış sürecini başlat" butonu bilerek gösterilir ve sunucunun reddi ekranda açıklanır.
- Yayındaki bir ilanın son fotoğrafı silinemez (yayında fotoğrafsız ilan oluşmasın).
- Opsiyonlu / satış bekleyen araçta bilgi düzenleme ve medya değişikliği yalnızca opsiyon sahibi veya yönetici (`src/lib/permissions.ts`). Bilgi düzenleme koşulu UPDATE sorgusunun içindedir.
- Bilinen sınırlama: medya yüklemede yetki kontrolü ile kayıt ayrı adımlardır; araç durumu tam o anda değişirse (ör. satış tamamlanırken eşzamanlı fotoğraf yükleme) fotoğraf yine de eklenebilir. Durum geçişleri etkilenmez. Üretimde kayıt işlemi koşullu tek işleme alınmalı.
- Bir video dosyası yalnızca bir araca ait olabilir (`Vehicle.videoPath` benzersiz).

## Giriş güvenliği (demo düzeyi)

- Şifreler bcrypt; kullanıcı yoksa da sahte özetle karşılaştırma yapılır (zamanlamadan e-posta tahmini önlenir).
- Hesap bazlı bellek içi deneme sınırı: bir hesaba 15 dakikada 10 hatalı deneme, sonrası 429. Sayaç yalnızca var olan kullanıcılar için tutulur (tablo personel sayısıyla sınırlı; tahliye yok, uydurma e-postalarla doldurulamaz). Kontrol ve sayım bcrypt'ten önce aynı senkron adımda yapılır. İstemci IP başlıklarına (X-Forwarded-For) güvenilmez.
- Kabul edilen sınırlamalar: kötü niyetli biri bir personel hesabını 15 dk kilitleyebilir; 429 yanıtı yalnızca var olan hesaplarda görüldüğü için çok sayıda denemeyle e-posta varlığı anlaşılabilir; sayaçlar sunucu yeniden başlatılınca sıfırlanır. Bellek içi tek bir tabloyla hem atlatma hem toplu kilitleme riskini aynı anda gidermek mümkün değil; üretimde güvenilir vekil yapılandırması + Redis gibi paylaşımlı TTL deposu + kademeli gecikme/CAPTCHA kullanılmalı.
- Seed kullanıcılarının kimlikleri sabittir (`demo-yonetici` vb.); `npm run db:reset` açık oturumları düşürmez.

## AI destekli araç girişi

- Servis katmanı: `src/lib/ai/vehicle-draft.ts`. Resmî Anthropic SDK, model `claude-opus-5-5`, `output_config.format` ile zod şemasına bağlı yapılandırılmış JSON (`messages.parse`). Effort `low` (basit çıkarım işi, maliyet/süre için).
- **Ses → metin** Claude ile yapılamaz; ayrı servis gerekir. `OPENAI_API_KEY` varsa Whisper (25 MB dosya sınırı) kullanılır; yoksa çalışan konuşma dökümünü elle yapıştırır.
- `ffmpeg` varsa videodan 2–4 kare çıkarılıp yalnızca görsel bağlam olarak AI'a verilir. **Bu kareler ilan fotoğrafı olarak kullanılmaz**; fotoğraflar her zaman çalışan tarafından yüklenir.
- Prompt: dökümde/karede olmayan bilgi uydurulmaz, bilinmeyen alan `null`; fiyat/km/hasar/ekspertiz asla tahmin edilmez; plaka/şasi/kişisel veri yazılmaz; her alan için kanıt alıntısı ve uyarı listesi döner.
- İnsan doğrulaması zorunlu: AI taslağından oluşturulan kayıtta "fiyat", "boya/değişen/hasar", "ekspertiz" onay kutuları işaretlenmeden sunucu kaydı reddeder. AI kaynağı (`aiDraftMode`, ham `aiDraftJson`) araçta saklanır ve CRM'de rozetle gösterilir.
- `ANTHROPIC_API_KEY` yoksa **Simülasyon Modu**: video gerçekten yüklenir ve araca bağlanır, ancak alanlar sabit örnek transkript/çıktıdan gelir; arayüz bunu büyük sarı bantla "canlı AI analizi değildir" diye belirtir.
- Canlı AI yolu API anahtarı olmadan uçtan uca test **edilemedi** (bkz. STATUS.md).

## Ertelenen kapsam

Gerçek WhatsApp API, Instagram DM, otomatik müşteri cevaplama, EİDS entegrasyonu, online ödeme/kapora, muhasebe, DMS, AI ekspertiz PDF analizi, ölçekleme, otomatik opsiyon süresi, üçüncü parti ilan senkronizasyonu. Ayrıca: renk/paket/motor gücü/çekiş/boya-değişen/donanım filtreleri (veri modeli hazır, filtre arayüzü yok), fotoğraf sıralama (sürükle-bırak), kullanıcı yönetimi ekranı, şifre değiştirme.

## Gerçek yayından önce çözülmesi gerekenler

**Hukuki**
- 2. el motorlu kara taşıtı ticareti mevzuatı: yetki belgesi numarasının ilanlarda gösterimi, ilan içeriği zorunlulukları. Veri modelinde `legalListingNo`, `legalAuthorizationNo`, `legalPlate`, `legalVin`, `legalOwnerConsent` alanları var; sitede gösterim kuralları belirlenmeli.
- EİDS (Elektronik İlan Doğrulama Sistemi) gerekliliğinin galeri sitesi için kapsamı netleştirilmeli.
- KVKK: aydınlatma metni, çerez politikası, WhatsApp üzerinden gelen kişisel veriler, personel verileri, saklama süreleri.
- Ekspertiz raporunun müşteriye açılması için rapor sahibi kurumun izni.
- Fotoğraf/video kullanım hakları; plaka maskeleme politikası.
- Site metinleri (Hakkımızda/İletişim), ticari unvan, MERSİS, adres gibi zorunlu bilgiler.

**Teknik**
- PostgreSQL + yönetilen yedekleme; dosyalar için nesne depolama (S3 vb.) ve CDN; görsel optimizasyonu/yeniden boyutlandırma.
- HTTPS, `COOKIE_SECURE=1`, güçlü `SESSION_SECRET`, giriş denemesi sınırlama (rate limit), CSRF için ek koruma (şu an SameSite=Lax çerez + JSON API), şifre politikası ve kullanıcı yönetimi, oturum iptali.
- Dosya yüklemelerinde virüs taraması; video dönüştürme (mobil uyumlu MP4/HLS).
- Hata izleme, loglama, denetim kaydının değiştirilemezliği.
- AI: maliyet limiti, zaman aşımı/yeniden deneme, kişisel veri içeren videoların üçüncü taraf AI servislerine gönderilmesi için hukuki değerlendirme (KVKK yurt dışı aktarım).
- Otomatik opsiyon süresi sona erdirme (zamanlanmış iş).
- Erişilebilirlik ve SEO (yayına geçince noindex kaldırılmalı).

## Görsel tasarım sistemi (müşteri sitesi)

- Referans: Borz Motor `/tum-araclar` yerleşimi ve kırmızı-beyaz-siyah ilan platformu hissi (kullanıcı talebiyle). Borz logosu, metinleri, fotoğrafları ve peşinat/kredi/konsinye/nakit alım özellikleri kopyalanmadı.
- Renk token'ları `src/app/globals.css` `@theme` bloğunda: `brand #BA1020`, `brand-dark #990C19` (hover), `ink #17191D`, `paper #F4F4F6`, `muted #646B76`, `line #E3E5E9`. Eski `accent` token'ı geriye dönük uyumluluk için `brand` ile aynı kırmızıya eşlendi; CRM bu sayede kırmızıya uyarlandı, bileşenleri değişmedi.
- Kırmızı: birincil CTA, kart fiyat bantları, aktif filtre etiketleri, bölüm vurgu çizgileri, bağlantı hover'ları, arama butonu, detay sayfası fiyat ve iletişim alanı.
- "Opsiyonlu" durumu metin + kilit ikonu ile gösterilir (yalnızca renge bağlı değil).
- Logo: Mir Motors'a özgü kelime markası (kırmızı eğik blok içinde "M" + MIR siyah / MOTORS kırmızı, tek satır).

## Demo araç fotoğrafları

- Kaynak: Unsplash (Unsplash License: ücretsiz ticari kullanım, izin/atıf zorunlu değil; Unsplash+ kullanılmadı). Dosya başına fotoğrafçı ve kaynak bağlantısı `public/demo-cars/CREDITS.md` içinde.
- Fotoğraflar projeye indirildi (`public/demo-cars/`); dış bağlantıya bağımlılık yok. Seed, fotoğrafları `storage/public/seed/` altına kopyalayıp normal araç fotoğrafı olarak kaydeder (CRM'de silme/kapak seçme çalışır).
- İşleme: 4:3 kırpma (kartlarla aynı oran), 1280×960, ~160 KB JPEG; görünür plakalar ve başka bir galerinin plaka logosu bulanıklaştırıldı; köşede "TEMSİLİ GÖRSEL · DEMO" etiketi (kart, galeri ve hero kırpmalarında görünür kalacak konumda).
- Model eşleşmesi: her araç için aynı marka/modelin fotoğrafı seçildi. Fotoğraftaki nesil/donanım farklıysa fotoğraf değil demo verisi uyarlandı (C Serisi 2020/W205, Evoque 2018/1. nesil, Golf GTI, XC60 2021 R-Design, renkler). Mini Cooper taslak olduğu için fotoğrafsızdır (fotoğrafsız yayın engelini göstermek için).
- Gerçek yayında yalnızca galerinin kendi çektiği fotoğraflar kullanılmalıdır.
