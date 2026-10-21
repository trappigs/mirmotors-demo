import type { Metadata } from "next";

export const metadata: Metadata = { title: "İletişim" };

export default function ContactPage() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-dark">İletişim</p>
      <h1 className="mt-3 font-display text-4xl font-bold">Bize ulaşın</h1>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold">Showroom</h2>
          <p className="mt-2 text-zinc-600">Adres bilgisi gerçek yayından önce eklenecektir. (Demo)</p>
          <p className="mt-4 text-sm text-zinc-500">Hafta içi 09:00 – 19:00 · Cumartesi 10:00 – 18:00</p>
        </div>
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold">WhatsApp</h2>
          <p className="mt-2 text-zinc-600">Araçlarla ilgili sorularınız için danışmanlarımıza yazabilirsiniz.</p>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn mt-4 bg-[#25D366] text-white hover:bg-[#1da851]">
              WhatsApp ile yazın
            </a>
          )}
          <p className="mt-3 text-xs text-zinc-500">Demo numarasıdır; gerçek numara yayın öncesi tanımlanacaktır.</p>
        </div>
      </div>
    </div>
  );
}
