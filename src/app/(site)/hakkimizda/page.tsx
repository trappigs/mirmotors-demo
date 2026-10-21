import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hakkımızda" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-dark">Hakkımızda</p>
      <h1 className="mt-3 font-display text-4xl font-bold">Araç alımında güven ve şeffaflık</h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-zinc-700">
        <p>
          Mir Motors, seçkin ikinci el araçları açık ekspertiz bilgisi ve kişisel danışmanlıkla müşterileriyle buluşturmayı
          hedefleyen bir galeridir.
        </p>
        <p>
          Her araç galeri ekibimiz tarafından fotoğraflanır; boya, değişen ve hasar bilgileri ilanda açıkça paylaşılır.
          Satış süreci galeride, yüz yüze ve noter devriyle tamamlanır.
        </p>
        <p className="rounded-lg bg-white p-5 text-sm text-zinc-500">
          Not: Bu sayfa demo içeriğidir. Kurumsal metin, yetki belgesi ve iletişim bilgileri gerçek yayından önce Mir Motors
          tarafından sağlanacaktır.
        </p>
      </div>
    </div>
  );
}
