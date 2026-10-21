"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";
import { StatusBadge } from "./StatusBadge";

type Props = {
  vehicleId: string;
  status: string;
  photoCount: number;
  user: { id: string; role: "ADMIN" | "SALES" };
  optionedBy: { id: string; name: string } | null;
  price: number;
};

/**
 * Durum işlemleri. Butonlar kullanıcıya yol göstermek içindir; asıl kontrol sunucudadır.
 * Bu yüzden başkasının opsiyonladığı araçta "Satışı başlat" butonu da gösterilir ve
 * tıklandığında sunucunun reddi açıkça görüntülenir (demo adım 11).
 */
export function StatusActions({ vehicleId, status, photoCount, user, optionedBy, price }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notary, setNotary] = useState(false);
  const [notaryDate, setNotaryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [agreedPrice, setAgreedPrice] = useState(String(price));
  const isAdmin = user.role === "ADMIN";
  const isOwner = optionedBy?.id === user.id;

  async function act(action: string, extra: Record<string, unknown> = {}, success = "İşlem tamamlandı") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiCall(`/api/crm/vehicles/${vehicleId}/transition`, { method: "POST", json: { action, ...extra } });
      setMessage(success);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5" data-testid="status-actions">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Durum ve satış</h2>
        <StatusBadge status={status} />
      </div>
      {optionedBy && (status === "OPTIONED" || status === "SALE_PENDING") && (
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900" data-testid="option-owner">
          Opsiyon sahibi: <strong>{optionedBy.name}</strong>{isOwner && " (siz)"}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {status === "DRAFT" && (
          <>
            {photoCount === 0 && <p className="text-sm text-amber-700">Yayımlamak için önce en az 1 fotoğraf yükleyin.</p>}
            <button disabled={busy} onClick={() => act("publish", {}, "Araç yayımlandı ve müşteri sitesinde görünüyor.")} className="btn-accent w-full py-3" data-testid="btn-publish">
              Kontrol ettim, yayımla
            </button>
          </>
        )}

        {status === "AVAILABLE" && (
          <>
            <button disabled={busy} onClick={() => act("option", {}, "Araç sizin adınıza opsiyonlandı.")} className="btn-primary w-full py-3" data-testid="btn-option">
              Opsiyonla
            </button>
            {isAdmin && (
              <button disabled={busy} onClick={() => act("unpublish", {}, "Araç yayından alındı (taslak).")} className="btn-outline w-full">
                Yayından al (taslağa çevir)
              </button>
            )}
          </>
        )}

        {status === "OPTIONED" && (
          <>
            <div>
              <label className="label" htmlFor="agreedPrice">Anlaşılan fiyat (TL)</label>
              <input id="agreedPrice" inputMode="numeric" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value.replace(/\D/g, ""))} className="input" />
            </div>
            <button
              disabled={busy}
              onClick={() => act("startSale", { agreedPrice: agreedPrice ? Number(agreedPrice) : undefined }, "Satış süreci başlatıldı. İlan müşteri sitesinden gizlendi.")}
              className="btn-primary w-full py-3"
              data-testid="btn-start-sale"
            >
              Satış sürecini başlat
            </button>
            {(isAdmin || isOwner) && (
              <button disabled={busy} onClick={() => act("releaseOption", {}, "Opsiyon kaldırıldı, araç yeniden satışta.")} className="btn-outline w-full" data-testid="btn-release">
                Opsiyonu kaldır ve satışa aç
              </button>
            )}
          </>
        )}

        {status === "SALE_PENDING" && (
          <>
            <div className="rounded-md border border-zinc-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={notary} onChange={(e) => setNotary(e.target.checked)} data-testid="chk-notary" />
                Noter devri tamamlandı
              </label>
              <label className="label mt-3" htmlFor="notaryDate">Noter devir tarihi</label>
              <input id="notaryDate" type="date" value={notaryDate} onChange={(e) => setNotaryDate(e.target.value)} className="input" />
            </div>
            <button
              disabled={busy || !notary}
              onClick={() => act("completeSale", { notaryCompleted: notary, notaryDate }, "Satış tamamlandı. İlan yayından kaldırıldı.")}
              className="btn-accent w-full py-3"
              data-testid="btn-complete-sale"
            >
              Satışı tamamla
            </button>
            {isAdmin && (
              <button disabled={busy} onClick={() => confirm("Satış iptal edilip araç yeniden satışa açılsın mı?") && act("cancelSale", {}, "Satış iptal edildi.")} className="btn-outline w-full text-red-600">
                Satışı iptal et (yönetici)
              </button>
            )}
          </>
        )}

        {status === "SOLD" && <p className="text-sm text-zinc-600">Bu araç satıldı. Kayıt ve geçmiş korunur; araç yeniden satışa açılamaz.</p>}
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700" role="alert" data-testid="action-error">{error}</p>}
      {message && <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="action-message">{message}</p>}
    </section>
  );
}
