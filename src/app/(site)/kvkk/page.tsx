import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { getCompanyInfo } from "@/lib/company";

export const metadata: Metadata = { title: "KVKK aydınlatma metni ve çerezler" };
export const dynamic = "force-dynamic";

const PENDING = "yayın öncesi eklenecek";

/**
 * 6698 sayılı KVKK m.10 aydınlatma metni + çerez bilgilendirmesi.
 * Veri sorumlusu bilgileri CRM > Ayarlar'dan gelir; girilmemiş bilgi uydurulmaz.
 * Müşteri sitesinde form, analiz veya reklam çerezi yoktur; metin bu duruma göre yazılmıştır.
 * Yayından önce bir hukukçu tarafından gözden geçirilmelidir.
 */
export default async function KvkkPage() {
  const c = await getCompanyInfo();
  const h2 = "mt-10 font-display text-xl font-bold tracking-tight text-ink";
  return (
    <>
      <PageHero eyebrow="Kişisel verilerin korunması" title="KVKK aydınlatma metni ve çerezler" />
      <article className="mx-auto max-w-3xl px-4 py-14 leading-relaxed text-zinc-700 sm:px-6" data-testid="kvkk">
        <h2 className={h2}>1. Veri sorumlusu</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div><dt className="inline font-semibold">Unvan: </dt><dd className="inline">{c.title ?? PENDING}</dd></div>
          <div><dt className="inline font-semibold">Adres: </dt><dd className="inline">{c.address ?? PENDING}</dd></div>
          {c.mersis && <div><dt className="inline font-semibold">MERSİS no: </dt><dd className="inline">{c.mersis}</dd></div>}
          <div><dt className="inline font-semibold">Yetki belgesi no: </dt><dd className="inline">{c.authorizationNo ?? PENDING}</dd></div>
        </dl>
        <p className="mt-3">
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla
          yukarıda bilgileri yer alan işletme tarafından aşağıda açıklanan kapsamda işlenmektedir.
        </p>

        <h2 className={h2}>2. Bu sitede hangi verileriniz işlenir?</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Bu sitede <strong>form bulunmaz</strong>; üyelik, ödeme veya kapora işlemi yapılmaz.</li>
          <li>
            Bizimle <strong>WhatsApp veya telefon</strong> üzerinden iletişime geçerseniz: adınız, telefon numaranız ve mesajınızın
            içeriği (ilgilendiğiniz araç, sorularınız).
          </li>
          <li>
            Siteyi ziyaret ettiğinizde, barındırma hizmetinin güvenlik amacıyla tuttuğu teknik kayıtlar (IP adresi, tarih-saat,
            tarayıcı bilgisi).
          </li>
        </ul>

        <h2 className={h2}>3. İşleme amaçları ve hukuki sebepler</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Araçlarla ilgili sorularınızı yanıtlamak, randevu ve showroom ziyaretini planlamak (KVKK m.5/2-c: bir sözleşmenin kurulmasıyla doğrudan ilgili olması).</li>
          <li>Sitenin güvenliğini sağlamak ve kötüye kullanımı önlemek (KVKK m.5/2-f: meşru menfaat).</li>
          <li>Mevzuattan doğan yükümlülükleri yerine getirmek ve yetkili kurumların taleplerini karşılamak (KVKK m.5/2-ç: hukuki yükümlülük).</li>
        </ul>
        <p className="mt-3">Verileriniz pazarlama veya reklam amacıyla kullanılmaz ve satılmaz.</p>

        <h2 className={h2}>4. Verilerin aktarılması</h2>
        <p className="mt-3">
          Verileriniz yalnızca yukarıdaki amaçlar için ve gerektiği ölçüde; yasal zorunluluk hâlinde yetkili kamu kurumlarıyla,
          hizmet aldığımız barındırma ve iletişim sağlayıcılarıyla paylaşılabilir. WhatsApp ile iletişime geçmeyi seçerseniz,
          mesajlarınız WhatsApp hizmetinin kendi koşullarına göre işlenir; bu hizmetin sunucuları yurt dışında bulunabilir.
        </p>

        <h2 className={h2}>5. Saklama süresi</h2>
        <p className="mt-3">
          İletişim kayıtları, talebiniz sonuçlandıktan sonra ilgili mevzuatta öngörülen veya işleme amacının gerektirdiği süre boyunca
          saklanır; süre sonunda silinir, yok edilir veya anonim hâle getirilir.
        </p>

        <h2 className={h2}>6. Haklarınız (KVKK m.11)</h2>
        <p className="mt-3">Veri sorumlusuna başvurarak;</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse buna ilişkin bilgi talep etme,</li>
          <li>işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
          <li>yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
          <li>eksik veya yanlış işlenmişse düzeltilmesini, şartları oluşmuşsa silinmesini veya yok edilmesini isteme ve bu işlemlerin aktarılan kişilere bildirilmesini isteme,</li>
          <li>münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,</li>
          <li>kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <p className="mt-3">
          haklarına sahipsiniz. Başvurularınızı yukarıdaki adrese yazılı olarak iletebilirsiniz. Başvurular en geç 30 gün içinde
          ücretsiz olarak sonuçlandırılır.
        </p>

        <h2 className={h2} id="cerezler">7. Çerezler</h2>
        <p className="mt-3">
          Bu sitenin müşteri bölümünde <strong>reklam, analiz veya takip çerezi kullanılmaz</strong>. Galeri personelinin giriş yaptığı
          yönetim panelinde yalnızca oturumun açık kalması için zorunlu bir oturum çerezi kullanılır; bu çerez müşterilerin
          tarayıcısına yerleştirilmez. Zorunlu çerezler için onay gerekmez. İleride analiz veya reklam çerezi kullanılırsa, bu çerezler
          yalnızca onayınız alınarak etkinleştirilecek ve bu metin güncellenecektir.
        </p>
      </article>
    </>
  );
}
