# Mir Motors — Geliştirme Yol Haritası (Burak için)

Mevcut durum: `BURAK_DEVIR.md` → "Özelliklerin mevcut durumu". Her aşamanın sonunda `STATUS.md` güncellenmeli.

## Aşama 1 — Demo sonrası

| İş | Not / ilgili yer |
|---|---|
| Mir Motors'tan geri bildirim toplama | Demo akışı `DEMO_SCRIPT.md`; görüşme notlarını `DECISIONS.md`'ye karar olarak işle |
| Gerçek araç verileriyle çalışma | Temsilî seed araçları yerine galerinin kendi araçları ve kendi çektiği fotoğraflar; plaka maskeleme politikası; `legal*` alanlarının doldurulması |
| Mevcut özelliklerde hata düzeltme | `BURAK_DEVIR.md` → "Bilinen hatalar": görsel yeniden boyutlandırma, yarım kalan Blob yüklemelerinin temizliği, medya kaydında koşullu tek işlem, preview/production veritabanı ayrımı |
| Küçük eksikler | Kullanıcı yönetimi ve şifre değiştirme, ek filtreler (renk, donanım, boya/değişen), fotoğraf sıralama, canlıdaki test kayıtlarının temizliği |

## Aşama 2 — Gerçek AI

Kod iskeleti var (`src/lib/ai/`), ancak **hiç gerçek anahtarla test edilmedi**; Vercel'de kapalı.

| İş | Not |
|---|---|
| Video konuşmasını metne çevirme | Şu an Whisper (`OPENAI_API_KEY`, 25 MB sınırı) planlı; Türkçe doğruluğu ve maliyeti ölçülmeli |
| Görüntü + transkript analizi | ffmpeg ile kare çıkarma yerel dosya ister; Vercel'de Blob'dan geçici dosyaya indirme veya ayrı bir işleyici gerekir |
| Yapılandırılmış araç bilgisi | `vehicle-draft.ts`: zod şemasına bağlı çıktı, kanıt alıntıları, uydurma yasağı |
| Çalışan onayı | Var: fiyat / boya-değişen-hasar / ekspertiz onayları olmadan kayıt alınmaz — korunmalı |
| Gerçek API anahtarlarıyla test | Örnek videolarla uçtan uca test, maliyet limiti, zaman aşımı/yeniden deneme; kişisel veri içeren videoların yurt dışı AI servislerine gönderimi için KVKK değerlendirmesi |

## Aşama 3 — Canlı kullanım

| İş | Not |
|---|---|
| EİDS ve ilan mevzuatı | Gereklilik netleşmeli; yalnızca Mir Motors adına tescilli araçlar; sosyal medyada doğrulanmış ilan bağlantısı; yetki belgesi no ve zorunlu ilan bilgileri |
| KVKK | Aydınlatma metni, çerez politikası, WhatsApp üzerinden gelen veriler, saklama süreleri, personel verileri |
| Şirket bilgileri | Ticari unvan, MERSİS, adres; Hakkımızda/İletişim metinlerinin gerçek içerikle değişmesi |
| Personel yönetimi | Kullanıcı ekleme/çıkarma, rol yönetimi, şifre politikası, oturum iptali |
| Veritabanı ve medya güvenliği | Yedekleme/geri yükleme, preview ortamı için ayrı veritabanı, CSRF jetonu, virüs taraması, denetim kaydı, hata izleme |
| Barındırma | Vercel Hobby ticari kullanım için uygun değil → Pro; Neon/Blob kotaları; özel alan adı; `noindex` ve DEMO bandının kaldırılması |
| Yük ve performans testleri | Görsel optimizasyonu/CDN, video dönüştürme (MP4/HLS), sayfa hızları |

## Aşama 4 — İleri otomasyon

| İş | Not |
|---|---|
| WhatsApp stok botu | WhatsApp Business API; stoktaki (AVAILABLE/OPTIONED) araçları sorgulama; mevcut `public-vehicles.ts` sorguları yeniden kullanılabilir |
| AI ekspertiz analizi | Ekspertiz PDF'inden özet; rapor sahibinin izni |
| Instagram DM destek asistanı | Instagram Graph API; story içerikleri zaten yerel veriden üretiliyor |
| Gelişmiş satış raporları | `Sale` ve `StatusHistory` tablolarından dönemsel satış, personel performansı, stokta kalma süresi |
| Müşteri CRM'i | Müşteri/lead modeli, araca ilgi kaydı, opsiyonun müşteriyle ilişkilendirilmesi |
