# KVKK Aydınlatma Metni — Taslak ve Hukukçuya Notlar

**Durum:** Taslak. Hukukçu tarafından gözden geçirilene kadar sitede "taslak" notuyla yayındadır.
**Metnin kendisi:** sitede `/kvkk` sayfası; kaynak dosya `src/app/(site)/kvkk/page.tsx` (bölümler `SECTIONS` dizisinde, düz metin).
**Hazırlayan:** yazılım ekibi (hukukçu değil). Kesin metin değildir.

## Metnin kapsamı

| Bölüm | İçerik |
|---|---|
| 1. Veri sorumlusu | Şirket bilgileri boş ("yayın öncesi eklenecek") |
| 2. İşlenen veriler | Site ziyaretçileri, müşteri adayları, alıcılar, araç sahipleri (EİDS), çalışanlar |
| 3. Amaçlar | Site güvenliği, bilgi talepleri, satış/noter, EİDS ilan doğrulaması, panel yetkilendirme, yasal yükümlülük, hakların korunması |
| 4. Yöntem ve hukuki sebep | KVKK 5/2 (c), (ç), (e), (f); açık rıza yalnızca pazarlama vb. için |
| 5. Aktarım | Ticaret Bakanlığı, noter, kamu kurumları, sunucu sağlayıcı (İstanbul), danışmanlar; WhatsApp (Meta) yurt dışı notu |
| 6. Saklama | Genel ifade (somut süre yok) |
| 7. Haklar | KVKK md. 11 |
| 8. Başvuru | Başvuru Tebliği'ndeki yollar, 30 gün, Kurul'a şikâyet |
| 9. Çerez | Müşteri sitesinde çerez yok; panelde zorunlu oturum çerezi |

## Sistemden doğrulanan teknik gerçekler (metin bunlara dayanıyor)

- Müşteri sitesi çerez, localStorage veya analiz/reklam aracı kullanmıyor. Müşteriden form ile veri toplanmıyor (iletişim WhatsApp bağlantısı, telefon ve showroom üzerinden).
- Tek çerez: yönetim paneli oturum çerezi `mm_session` — httpOnly, 12 saat, yalnızca personel.
- Panelde tutulanlar: personel ad-soyad, e-posta, rol, bcrypt şifre özeti, başarısız giriş sayacı, araç işlem geçmişi (kim, ne zaman, hangi durum değişikliği), satış kayıtları (fiyat, noter tarihi, işlemi yapan personel). Alıcı müşterinin kimlik bilgisi şu an sistemde tutulmuyor (galeride kağıt/noter süreci).
- Sunucu: Febzen, İstanbul (Türkiye). Veritabanı ve yüklenen dosyalar bu sunucuda. Gece yedekleri aynı sunucuda.
- Sunucu erişim kayıtları (IP, sayfa, zaman): uygulama ve web sunucusu günlükleri, boyut sınırlı döner kayıt (en fazla ~30 MB/servis).
- Eski demo kopyası Vercel'de (Frankfurt, Almanya) ve Neon (Frankfurt) üzerinde hâlâ duruyor; içinde gerçek kişisel veri yok (temsili demo verisi). Gerçek kullanıma geçmeden kapatılması önerilir.
- Planlanan: EİDS entegrasyonu (e-Devlet ile doğrulama; ad-soyad, T.C. kimlik no, telefon, vergi no, yetki belgesi no, plaka), telefon doğrulaması için SMS sağlayıcısı.

## Hukukçunun karar vermesi gereken açık noktalar

1. **Veri sorumlusu bilgileri:** ticari unvan, adres, MERSİS, KEP, başvuru e-postası.
2. **VERBİS:** kayıt yükümlülüğü var mı (çalışan sayısı / mali bilanço eşiği, istisnalar)?
3. **Saklama süreleri:** somut süreler eklenmeli mi? Öneri olarak düşünülen dayanaklar: ticari defter ve belgeler (TTK md. 82), genel zamanaşımı (TBK), personel kayıtları. Sunucu erişim kayıtları için süre.
4. **WhatsApp (yurt dışı aktarım):** kişinin kendi seçtiği WhatsApp kanalıyla iletişimin KVKK md. 9 (2024 değişikliği sonrası) kapsamında nasıl değerlendirileceği; metindeki ifade yeterli mi?
5. **EİDS verileri:** T.C. kimlik no ve doğrulama sonuçlarının hukuki sebebi olarak "hukuki yükümlülük" (Motorlu Kara Taşıtlarının Ticareti Hakkında Yönetmelik) doğru mu? Saklama süresi?
6. **SMS sağlayıcısı:** seçildiğinde aktarım alıcısı olarak eklenecek; veri işleyen sözleşmesi.
7. **Çalışanlar için ayrı metin:** personele yönelik ayrı bir aydınlatma metni (işe giriş sürecinde imzalı) gerekli mi? Sitedeki metin yalnızca panel kullanımını kapsıyor.
8. **Ekspertiz raporları:** ekspertiz PDF'lerinde araç sahibine ait kişisel veri olabilir; yalnızca personel erişiyor. Saklama ve müşteriye gösterim kuralı.
9. **Çerez:** gelecekte analiz aracı eklenirse çerez onay mekanizması gerekecek (şu an gerekmiyor).
10. **Açık rıza metni:** pazarlama (SMS/e-posta kampanya) planlanıyorsa ayrı açık rıza ve İYS kaydı.
