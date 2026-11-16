"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";
import { DOC_KIND_LABELS, type DocKind } from "@/lib/doc-review";

type Doc = { id: string; path: string; kind: string; page: number; by: string; quality: string[] };
const Q: Record<string, string> = { LOW_RES: "düşük çözünürlük", DARK: "karanlık", BLURRY: "bulanık", CROPPED: "kesik", GLARE: "parlama" };

/** Araca bağlı ruhsat / kontrol formu / ekspertiz görselleri: yalnızca CRM'de. Görüntüleme ve silme denetim kaydına yazılır. */
export function VehicleDocuments({ vehicleId, docs, readOnly }: { vehicleId: string; docs: Doc[]; readOnly: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="card p-5" data-testid="vehicle-documents">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Belgeler (ruhsat / kontrol formu / ekspertiz)</h2>
          <p className="text-xs text-zinc-500">Yalnızca CRM&apos;de görünür; müşteri sitesinde yayımlanmaz. Görüntüleme ve silme kayıt altına alınır.</p>
        </div>
        {!readOnly && <Link href={`/crm/vehicles/new/belge?arac=${vehicleId}`} className="btn-outline" data-testid="add-document">Belge ekle</Link>}
      </div>
      {docs.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Belge yok. Kontrol formu veya ekspertiz eklerseniz okunan bilgiler yalnızca boş alanlara aktarılır; mevcut bilgiler korunur.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {docs.map((d) => (
            <li key={d.id} data-doc-id={d.id}>
              <a href={`/api/crm/files/${d.path}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-zinc-200 hover:border-zinc-500">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/crm/files/${d.path}`} alt={`${DOC_KIND_LABELS[d.kind as DocKind] ?? d.kind} sayfa ${d.page}`} loading="lazy" className="aspect-[3/4] w-full bg-zinc-100 object-contain" />
              </a>
              <p className="mt-1 text-xs text-zinc-600">{DOC_KIND_LABELS[d.kind as DocKind] ?? d.kind} · {d.kind === "FORM" ? "görsel" : "sayfa"} {d.page} · {d.by}</p>
              {d.quality.length > 0 && <p className="text-[11px] text-amber-700">⚠ {d.quality.map((q) => Q[q] ?? q).join(", ")}</p>}
              {!readOnly && (
                <button type="button" disabled={busy} className="text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    if (!confirm("Belge görseli kalıcı olarak silinsin mi?")) return;
                    setBusy(true);
                    setError("");
                    try {
                      await apiCall(`/api/crm/documents/${d.id}`, { method: "DELETE" });
                      router.refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}>Sil</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
