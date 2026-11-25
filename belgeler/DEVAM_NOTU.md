# Mir Motors — Devam notu (4 Kasım 2026)

Yeni sohbette önce bu dosyayı oku. Burak'ın istediği işe göre yalnızca ilgili bölümü kullan; hepsini birden yapmaya kalkma.

## Kurallar (değişmedi)
- Her yanıt Türkçe.
- Yalnızca yerel çalışılır. Burak açıkça "WEB'E TAŞI" demeden: deploy yok, push yok, istenmedikçe commit yok; Neon, Vercel Blob, env ayarlarına dokunulmaz.
- Gerçek EİDS'e istek yok; gerçek müşteri verisi AI'a gönderilmez (sentetik belge kullanılır).
- Proje kuralları: `CLAUDE.md` (durum geçişleri `vehicle-status.ts`, uydurma veri yok, DEMO bandı kalır).

## Yerel çalışma
- Dal: `demo-v1`. Değişiklikler commit edilmedi (git status'ta görünür).
- Yerel veritabanı `prisma dev` (ana ve test). Durursa: `npx prisma dev --name mirmotors --detach`.
- Önizleme: `mirmotors-start` (npm start, port 3000) → kod değişince önce `npm run build`.
- Yerel yönetici: `yonetici@mirmotors.demo` (şifre seed dosyasında).
- Testler: `npx vitest run tests` (TEST_DATABASE_URL ile), `npm run e2e` (sunucu açıkken). Son durum: 71 birim + 176 E2E geçti.
- Dikkat: `prisma dev` tek bağlantı kaldırıyor; veritabanına script çalıştırmadan önce sunucuyu durdur.

## Bu güne kadar yerelde yapılanlar (commit edilmedi)
1. Mevzuat uyumu: yayın kontrol listesi (`src/lib/listing-rules.ts`), eksik her madde yayını engeller, sunucuda doğrulanır. Araç tipi (ruhsat D.2) alanı eklendi.
2. Kağıt "Araç Kontrol ve İlan Bilgi Formu": `belgeler/arac-kontrol-formu.html/.pdf` (2 sayfa).
3. Belgelerden ekleme: yalnızca ruhsat + kontrol formu (dış ekspertiz kaldırıldı). AI okur, sunucu doğrular, ruhsat ↔ form çelişkisini gösterir. Sentetik belgeyle canlı denendi (~0,20 $/araç, ~50 sn).
4. Seçenekler sadeleşti: hasar (girilmedi/yok/var/ağır hasar), rehin (girilmedi/yok/var), garanti (girilmedi/yok/devam ediyor).
5. Formda plaka ve fiyat en üstte, boşken kırmızı.
6. Başka bir çalışmadan gelmiş görünen değişiklikler de var (takas alanı, renk eşleme, `tests/quick-entry.test.ts`, `DECISIONS.md` eki). Bunlara dokunma.

## Hedef (Burak'ın tarifi)
- Tek galeri, ortalama haftada 20 ilan. Sahibinden ölçeğinde değil; sade ve hızlı sistem.
- Personel iPhone'dan girer: ruhsat fotoğrafı → AI doldurur → personel fiyat, km, kaporta, donanım, fotoğrafları tamamlar → sonda tek kontrol ekranı.
- Ayrıca tamamen manuel giriş (AI'sız). Ruhsatın zorunlu olup olmayacağı henüz kararlaştırılmadı.
- WhatsApp entegrasyonu şimdilik YOK.

## Analizden çıkan önemli eksikler (kod incelemesi, iPhone'da test edilmedi)
- Kasa tiplerinde Panelvan/Kamyonet/Minibüs yok → ticari araç yayımlanamıyor.
- Kaporta şemasının ayrı "Kaydet" düğmesi var; "Kaydet ve devam et"e basılırsa şema değişiklikleri kaybolur.
- Manuel girişte aynı plaka/şasi için uyarı yok.
- Satış personeli de yayımlayabiliyor; yayımlayan kişi araç kaydında tutulmuyor (yalnızca geçmişte).
- Fotoğraf: HEIC yok, telefonda küçültme yok, ilerleme ve yeniden deneme yok, yarım kalan yükleme sahipsiz dosya bırakıyor, fotoğraflar ancak 3. adımda eklenebiliyor (`src/components/crm/MediaManager.tsx`).
- Kontrol ekranı (sihirbaz 4. adım) var ama eksikler üstte değil, "Düzelt" ilgili alana değil yalnızca adıma götürüyor. "Onay bekleyenler" kuyruğu yok.
- PWA yok (manifest, standalone yok); CRM menüsü telefonda kayıyor, kutular 14 px (iOS yakınlaştırır), düğmeler küçük, otomatik taslak yok.
- Katalog: kodda 11 marka / 62 model, serbest metin; ticari araç yok.

## Önerilen sade plan (Burak henüz onaylamadı)
1. Küçük kritik düzeltmeler: ticari kasa tipleri, kaporta kayıt kaybı, aynı plaka uyarısı.
2. iPhone'da fotoğraf: HEIC, küçültme, ilerleme, yeniden deneme; fotoğraflar bilgi girişiyle aynı akışta.
3. Tek kontrol ekranı + "Onaya gönder" / "Yayımla" ayrımı + panelde "Onay bekleyen N araç" kartı; yayımlayan kaydedilir.
4. Telefona uygun arayüz: alt menü, büyük düğmeler, ana ekrana ekleme, yerel taslak.
Gerekmeyenler (bu ölçekte): tam kademeli katalog, çevrimdışı eşitleme, video dönüştürme.

## Açık kararlar (Burak'a sor)
- İlanı kim yayımlasın? (Öneri: personel "Onaya gönder", yönetici yayımlar.)
- Manuel girişte ruhsat zorunlu mu?
- Marka/model listesi nasıl büyüsün? (Öneri: küçük liste + girilen yeni markalar öneri olur.)

## Yeni iş gelince
Bu dosyanın sonuna tarihli bir satır ekle: ne istendi, ne yapıldı, ne kaldı.

## 5 Kasım 2026 — Faz 1 (yerelde, commit yok)
- Otomatik taslak kaydı (`src/lib/client-autosave.ts`, `WizardStepForm`), kaporta otomatik kaydı, aynı plaka uyarısı (`src/lib/plates.ts`), Panelvan/Kamyonet/Minibüs, tek son kontrol ekranı + "Düzelt" (`src/lib/fix-targets.ts`, `tamamla/page.tsx`), belge kontrolü bekleyen araç son ekrandan tek onayla yayımlanır.
- Yerel migration: `20261105090000_taslak_anahtari` (Vehicle.createKey).
- Burak'ın belgesindeki "ekspertiz" = bizim kontrol formumuz (AI girişi: ruhsat + kontrol formu). "Kimden" alanı yok, gerek yok.
- Kalan: gerçek iPhone testi; E2E'deki "sirala=year_asc" hatası yerel veritabanında biriken eski test araçlarından (temizlenince geçer).

## 5 Kasım 2026 — Faz 2–5 + kalite kontrol (yerelde, commit yok)
- Faz 2: eşzamanlı düzenleme koruması (baseVersion/STALE), aramalı marka/model (SuggestInput, genişletilmiş BRAND_MODELS), D.3 ticari ad + muayene tarihi (yeni alanlar), teknik kodsuz etiketler.
- Faz 3 (ajan): MediaManager — HEIC, telefonda küçültme, kamera, dosya bazında ilerleme/yeniden deneme, sürükle-bırak sıralama (photo-grid, photo-prepare, photo-upload).
- Faz 4 (ajan): CRM manifest (/pwa/crm.webmanifest), ikonlar public/pwa, mobil alt menü (MobileNav), 5 düğmeli ana ekran, 16px form yazısı, 14 gün kayan oturum.
- Faz 5 (ajan): ARCHIVED durumu + archive/restore, "Satıldı" (AVAILABLE'dan satış başlatma, noter onayı korunur), Web Push altyapısı (VAPID anahtarları YOK → bildirim gönderilmez).
- Yerel migration: 20261105100000_faz2_5. Testler: 121 birim + 191 E2E geçti.
- Açık karar: rehin "Doğrulanmadı" / garanti "Bilinmiyor" geri gelsin mi (şu an sade hâl).
- Gizlilik: tests/document-sanitize.test.ts içinde gerçek bir ruhsatın plaka+şasisi var (eskiden) → sentetiğe çevrilmeli.

## 23 Kasım 2026 — Personel yönetimi, KVKK, form sadeleştirme (yerelde, commit yok)
- Ayarlar > Personel: ekle (geçici şifre, ilk girişte /crm/sifre zorunlu), düzenle, pasif/aktif yap, şifre sıfırla, telefon alanı (WhatsApp tanıma için). Pasif yapma / şifre sıfırlama `sessionVersion` ile oturumları anında kapatır. Son aktif yönetici korunur. `src/lib/staff.ts`, `/api/crm/staff`, `/api/crm/account/password`, `StaffManager.tsx`.
- PWA oturumu 180 gün (kayan). Yerel migration: `20261123090000_personel` (User alanları + StaffEvent).
- Müşteri sitesi: /kvkk (aydınlatma + çerez bilgisi, şirket bilgisi Ayarlar'dan), altbilgide bağlantı. İlan sayfasından "Ekspertiz özeti" kalktı (CRM formundan da). Etiketler: Seri / Model.
- Elle giriş formu sahibinden düzeninde: Marka · Seri · Model; Araç cinsi düğme (kasadan otomatik); ruhsattaki tip isteğe bağlı. Yayın kontrolü: tip = ruhsattaki tip VEYA model.
- Testlerdeki gerçek ruhsat değerleri sentetiğe çevrildi.
- Yetki belgeleri (IETTS sorgusu): 3416628 = MİR MOTORS OTO KİRALAMA VE TİCARET LTD. ŞTİ. (Yeni Çamlıca Mah. Yavuz Sk. No:17A Ataşehir, 09.04.2026); 3408026 = şahıs işletmesi "MİR MOTORS" (Kayışdağı Mah. Şair Veysel Sk. No:6 Ataşehir, 25.09.2024; sahibinden mağazası bu numarayla). Yerel Ayarlar: unvan Ltd., yetki 3416628, adres Google'daki (Ferhatpaşa 9. Sk. No:37) — adres yetki belgelerindekiyle aynı değil, Burak'a soruldu.
- Testler: 121 birim + 189 E2E + 21 personel kontrolü geçti.
