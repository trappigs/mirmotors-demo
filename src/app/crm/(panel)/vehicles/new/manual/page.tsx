import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ManualWizard } from "./ManualWizard";

/** Elle ekleme sihirbazı · 1. adım: ilk değişiklikte taslak oluşur, bilgiler otomatik kaydedilir. Yarım kalan taslaklar üstte listelenir. */
export default async function ManualNewVehiclePage() {
  const user = await requireUser();
  const drafts = await prisma.vehicle.findMany({
    where: { createdById: user.id, status: { in: ["DRAFT", "REVIEW"] } },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { id: true, brand: true, model: true, year: true, legalPlate: true, updatedAt: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm/vehicles/new" className="text-sm text-zinc-500 hover:text-ink">← Giriş yöntemi</Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Elle araç ekle</h1>
        <p className="text-sm text-zinc-500">Bilgiler siz yazdıkça otomatik kaydedilir. Bölümler arasında istediğiniz gibi geçebilirsiniz; araç yayımlanana kadar taslak kalır ve müşteriye görünmez.</p>
      </div>
      {drafts.length > 0 && (
        <section className="card p-4" data-testid="my-drafts">
          <p className="text-sm font-semibold">Yarım kalan taslaklarınız</p>
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {[d.brand ?? "Marka girilmedi", d.model, d.year].filter(Boolean).join(" ")}
                  {d.legalPlate && <span className="text-zinc-500"> · {d.legalPlate}</span>}
                  <span className="block text-xs text-zinc-400">Son değişiklik {formatDateTime(d.updatedAt)}</span>
                </span>
                <Link href={`/crm/vehicles/${d.id}/tamamla`} className="btn-outline py-1.5 text-xs">Devam et</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ManualWizard />
    </div>
  );
}
