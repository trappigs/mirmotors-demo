import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { IconCamera, IconDoc, IconShield } from "@/components/site/Icons";

export const metadata: Metadata = { title: "Hakkımızda" };

const VALUES = [
  { icon: IconDoc, title: "Açık bilgi", text: "Boya, değişen, hasar ve ekspertiz özeti her ilanda paylaşılır." },
  { icon: IconCamera, title: "Gerçek görüntü", text: "Araçlar galeri ekibimiz tarafından fotoğraflanır." },
  { icon: IconShield, title: "Güvenli satış", text: "Satış galeride, yüz yüze ve noter devriyle tamamlanır." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="Hakkımızda" title="Araç alımında güven ve şeffaflık" />
      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5 text-lg leading-relaxed text-zinc-700">
          <p>
            Mir Motors, seçkin ikinci el araçları açık ekspertiz bilgisi ve kişisel danışmanlıkla müşterileriyle buluşturmayı
            hedefleyen bir galeridir.
          </p>
          <p>
            Her araç galeri ekibimiz tarafından fotoğraflanır; boya, değişen ve hasar bilgileri ilanda açıkça paylaşılır.
            Satış süreci galeride, yüz yüze ve noter devriyle tamamlanır.
          </p>
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-500">
            Not: Bu sayfa demo içeriğidir. Kurumsal metin, yetki belgesi ve iletişim bilgileri gerçek yayından önce Mir Motors
            tarafından sağlanacaktır.
          </p>
          <Link href="/araclar" className="btn-primary mt-2 px-6 py-3">Stoğu inceleyin</Link>
        </div>
        <ul className="space-y-4">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card flex gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-paper text-accent-dark"><Icon className="h-5 w-5" /></span>
              <div>
                <h2 className="font-display font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-zinc-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
