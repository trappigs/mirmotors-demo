import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni" };

// Taslak metin: hukuki inceleme bekliyor. Aynı içerik ve hukukçuya notlar: docs/KVKK_AYDINLATMA_TASLAK.md
// Şirket bilgileri gerçek değerler gelene kadar "yayın öncesi eklenecek" olarak kalır; uydurma bilgi yazılmaz.
const PENDING = "yayın öncesi eklenecek";
const UPDATED = "4 Kasım 2026";

type Section = { id: string; title: string; body: (string | string[])[] };

const SECTIONS: Section[] = [
  {
    id: "veri-sorumlusu",
    title: "1. Veri sorumlusu",
    body: [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla Mir Motors tarafından aşağıda açıklanan kapsamda işlenmektedir.",
      [
        `Ticari unvan: ${PENDING}`,
        `Adres: ${PENDING}`,
        `MERSİS numarası: ${PENDING}`,
        `KEP adresi: ${PENDING}`,
        `E-posta: ${PENDING}`,
      ],
    ],
  },
  {
    id: "veriler",
    title: "2. İşlenen kişisel veriler",
    body: [
      "İlişkimizin türüne göre aşağıdaki kişisel veriler işlenebilir:",
      [
        "Site ziyaretçileri: IP adresi, tarayıcı ve cihaz bilgisi, ziyaret edilen sayfa, tarih ve saat (sunucu kayıtları). Müşteri sitesinde reklam veya analiz amaçlı çerez kullanılmaz.",
        "Bizimle iletişime geçen müşteri adayları (WhatsApp, telefon, e-posta, showroom): ad-soyad, telefon numarası, e-posta adresi, mesaj içeriği, ilgilendiğiniz araç ve görüşme notları.",
        "Araç satın alan müşteriler: kimlik bilgileri, iletişim bilgileri, satış ve noter devrine ilişkin bilgiler, satılan araca ilişkin bilgiler.",
        "Aracını satışa sunan veya ilan yetkisi veren araç sahipleri: ad-soyad, T.C. kimlik numarası, telefon numarası, tüzel kişilerde unvan, vergi numarası ve yetki belgesi numarası, araç plakası ve araca ilişkin bilgiler, Elektronik İlan Doğrulama Sistemi (EİDS) doğrulama sonucu.",
        "Çalışanlarımız (yönetim paneli kullanıcıları): ad-soyad, kurumsal e-posta adresi, görev/rol, şifrenin geri döndürülemez özeti, panelde yapılan işlemlerin kaydı (hangi araçta hangi işlemin ne zaman yapıldığı), oturum çerezi, başarısız giriş denemesi sayısı ve bildirimleri açtıysanız cihaz bildirim aboneliği.",
      ],
    ],
  },
  {
    id: "amaclar",
    title: "3. İşleme amaçları",
    body: [
      [
        "Sitenin işletilmesi, güvenliğinin sağlanması ve kötüye kullanımın önlenmesi,",
        "Araçlarla ilgili bilgi taleplerinizin yanıtlanması ve showroom ziyaretlerinin planlanması,",
        "Araç satış sürecinin yürütülmesi, satış ve noter devri işlemlerinin tamamlanması,",
        "Motorlu Kara Taşıtlarının Ticareti Hakkında Yönetmelik kapsamında ilanların yayımlanmadan önce Ticaret Bakanlığı'nın elektronik sistemleri (EİDS) üzerinden doğrulanması ve ilan bilgilerinin mevzuata uygun gösterilmesi,",
        "Yönetim panelinde yetkilendirme yapılması ve işlem geçmişinin tutulması,",
        "Yasal yükümlülüklerin yerine getirilmesi, yetkili kurum ve kuruluşların taleplerinin karşılanması,",
        "Olası uyuşmazlıklarda hakların tesisi, kullanılması ve korunması.",
      ],
    ],
  },
  {
    id: "hukuki-sebep",
    title: "4. Toplama yöntemi ve hukuki sebepler",
    body: [
      "Kişisel verileriniz; site ve sunucu kayıtları aracılığıyla otomatik yollarla, WhatsApp, telefon, e-posta ve showroom görüşmeleri aracılığıyla, çalışanlarımızın yönetim paneline girdiği kayıtlarla ve EİDS doğrulaması sırasında e-Devlet üzerinden Ticaret Bakanlığı sistemleri aracılığıyla toplanır.",
      "Bu veriler KVKK'nın 5. maddesinin 2. fıkrasında yer alan şu hukuki sebeplere dayanılarak işlenir:",
      [
        "Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (araç satışı, bilgi talebi),",
        "Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması (ilan doğrulama, ticari kayıtların saklanması),",
        "Bir hakkın tesisi, kullanılması veya korunması için zorunlu olması,",
        "İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için zorunlu olması (site ve panel güvenliği, işlem kaydı).",
      ],
      "Bu hukuki sebeplerin dışında kalan bir işleme (örneğin pazarlama iletişimi) yapılması gerekirse ayrıca açık rızanız alınır. Şu an pazarlama amaçlı ileti gönderilmemektedir.",
    ],
  },
  {
    id: "aktarim",
    title: "5. Kişisel verilerin aktarılması",
    body: [
      "Kişisel verileriniz yukarıdaki amaçlarla sınırlı olarak ve gerektiği ölçüde şu alıcılara aktarılabilir:",
      [
        "Ticaret Bakanlığı (EİDS ilan doğrulaması),",
        "Noterlikler (araç devri),",
        "Kanunen yetkili kamu kurum ve kuruluşları (talep halinde),",
        "Hizmet aldığımız sunucu sağlayıcısı (veriler İstanbul'daki veri merkezinde saklanır),",
        "Hukuki ve mali danışmanlarımız.",
      ],
      "Bizimle WhatsApp üzerinden iletişime geçmeyi seçmeniz halinde mesajlarınız WhatsApp (Meta) altyapısında, WhatsApp'ın kendi koşulları çerçevesinde işlenir; bu altyapının sunucuları yurt dışında bulunabilir. İletişim için telefon, e-posta veya showroom kanallarını da kullanabilirsiniz.",
      "Yönetim panelindeki otomatik belge okuma özelliği kullanıldığında, araç ruhsatı ve ekspertiz raporu görüntüleri ilan bilgilerinin çıkarılması amacıyla yurt dışında bulunan bir yapay zekâ hizmet sağlayıcısına (OpenAI) iletilir. Bu özellik yalnızca çalışanlarımız tarafından ve gerektiğinde kullanılır.",
    ],
  },
  {
    id: "saklama",
    title: "6. Saklama süresi",
    body: [
      "Kişisel verileriniz, işlenme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen saklama süreleri boyunca saklanır; sürenin sona ermesiyle silinir, yok edilir veya anonim hale getirilir. Satış ve ticari kayıtlar ilgili mevzuatın öngördüğü süre boyunca muhafaza edilir.",
    ],
  },
  {
    id: "haklar",
    title: "7. KVKK'nın 11. maddesi kapsamındaki haklarınız",
    body: [
      [
        "Kişisel verilerinizin işlenip işlenmediğini öğrenme,",
        "İşlenmişse buna ilişkin bilgi talep etme,",
        "İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,",
        "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,",
        "Eksik veya yanlış işlenmişse düzeltilmesini isteme,",
        "KVKK'nın 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,",
        "Düzeltme, silme veya yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,",
        "Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme,",
        "Kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme.",
      ],
    ],
  },
  {
    id: "basvuru",
    title: "8. Başvuru yolu",
    body: [
      "Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak; yukarıdaki adrese yazılı olarak, KEP adresimize, güvenli elektronik imza veya mobil imza ile ya da daha önce bize bildirdiğiniz ve sistemlerimizde kayıtlı e-posta adresinizden iletebilirsiniz.",
      "Başvurunuz, talebin niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz olarak sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi halinde Kişisel Verileri Koruma Kurulu'nca belirlenen tarifedeki ücret alınabilir. Başvurunuzun reddedilmesi, verilen cevabın yetersiz bulunması veya süresinde cevap verilmemesi halinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz.",
    ],
  },
  {
    id: "cerez",
    title: "9. Çerez bilgilendirmesi",
    body: [
      "Müşteri sitesinde çerez veya benzeri tarayıcı depolaması kullanılmaz; reklam, analiz veya kişiselleştirme amaçlı çerez bulunmamaktadır.",
      "Yalnızca çalışanlarımızın kullandığı yönetim panelinde, oturumun açık tutulması için zorunlu bir oturum çerezi kullanılır (adı: mm_session, süresi: 14 gün, panel kullanıldıkça yenilenir, tarayıcı betikleriyle okunamaz). Bu çerez hizmetin sunulması için zorunlu olduğundan ayrıca onay alınmaz.",
      "Panelde bağlantı koptuğunda kaydedilemeyen form değişiklikleri, yeniden gönderilinceye kadar yalnızca çalışanın cihazında (tarayıcı yerel depolaması) tutulur. Bildirimleri açan çalışanın cihazı için tarayıcının bildirim aboneliği bilgisi sunucumuzda saklanır; bildirimler kapatıldığında silinir.",
      "İleride analiz veya pazarlama amaçlı çerez kullanılması halinde, bu çerezler yalnızca onayınızla etkinleştirilecek ve bu metin güncellenecektir.",
    ],
  },
];

export default function KvkkPage() {
  return (
    <>
      <PageHero eyebrow="Yasal" title="KVKK Aydınlatma Metni ve Çerez Bilgilendirmesi" />
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <p className="rounded-2xl border border-dashed border-brand/40 bg-brand-soft p-5 text-sm text-ink" data-testid="kvkk-draft-note">
          Bu metin taslaktır ve hukuki inceleme sonrasında güncellenecektir. Şirket bilgileri gerçek yayından önce eklenecektir.
        </p>
        <nav className="mt-8 flex flex-wrap gap-2 text-sm" aria-label="Bölümler">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="chip hover:border-brand hover:text-brand">{s.title.replace(/^\d+\.\s*/, "")}</a>
          ))}
        </nav>
        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-zinc-700">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="section-mark font-display text-xl font-bold text-ink">{s.title}</h2>
              <div className="mt-4 space-y-3">
                {s.body.map((b, i) =>
                  Array.isArray(b) ? (
                    <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-brand">
                      {b.map((li) => <li key={li}>{li}</li>)}
                    </ul>
                  ) : (
                    <p key={i}>{b}</p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-12 text-xs text-muted">Son güncelleme: {UPDATED}</p>
      </div>
    </>
  );
}
