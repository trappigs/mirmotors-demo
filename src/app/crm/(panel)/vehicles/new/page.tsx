import Link from "next/link";

// İki giriş yolu, aynı araç kaydı ve aynı son kontrol: AI ile (ruhsat fotoğrafı, isteğe bağlı kontrol formu) veya manuel.
// Videodan AI taslağı canlıda simülasyon olduğu için bu ekranda sunulmuyor; /crm/vehicles/new/ai rotası duruyor.
export default function NewVehicleChooser() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Yeni araç ekle</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/crm/vehicles/new/belge" className="card block border-accent/50 p-6 transition hover:border-zinc-900" data-testid="choose-doc">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Önerilen</p>
          <h2 className="mt-1 font-display text-xl font-semibold">AI ile araç ekle</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Ruhsatın fotoğrafını çekin (isterseniz doldurduğunuz Mir Motors kontrol formunu da ekleyin). Bilgiler otomatik doldurulur; kalanını siz tamamlarsınız.
          </p>
          <p className="mt-3 text-xs text-zinc-500">Kişisel bilgiler göndermeden önce kapatılır. Fotoğraf, PDF ve iPhone (HEIC) desteklenir.</p>
        </Link>
        <Link href="/crm/vehicles/new/manual" className="card block p-6 transition hover:border-zinc-900" data-testid="choose-manual">
          <h2 className="mt-5 font-display text-xl font-semibold">Manuel araç ekle</h2>
          <p className="mt-2 text-sm text-zinc-600">Bilgileri kendiniz girin; ruhsat fotoğrafı gerekmez. Fotoğrafları ekleyip son kontrolden sonra yayımlayın.</p>
        </Link>
      </div>
    </div>
  );
}
