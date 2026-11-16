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
  price: number | null;
  /** Arşivleme butonu gösterilsin mi (sunucu ayrıca kontrol eder). */
  canArchive?: boolean;
  /** Eski ad (kalıcı silme kaldırıldı): artık "Arşivle" butonunu gösterir. Yeni kodda canArchive kullanın. */
  canDelete?: boolean;
  /** Arşivdeki araç için "kim · ne zaman · önceki durum" bilgisi. */
  archivedInfo?: string | null;
  /** "Satıldı" formundaki satan personel listesi (boşsa işlemi yapan kişi kaydedilir). */
  staff?: { id: string; name: string }[];
};

/**
 * Durum işlemleri. Butonlar kullanıcıya yol göstermek içindir; asıl kontrol sunucudadır.
 * Bu yüzden başkasının opsiyonladığı araçta "Satıldı" butonu da gösterilir ve
 * tıklandığında sunucunun reddi açıkça görüntülenir (demo adım 11).
 * Kalıcı silme arayüzde yoktur; yanlış/mükerrer kayıt arşivlenir.
 */
export function StatusActions({ vehicleId, status, photoCount, user, optionedBy, price, canArchive: canArchiveProp, canDelete, archivedInfo, staff = [] }: Props) {
  const canArchive = canArchiveProp ?? canDelete;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notary, setNotary] = useState(false);
  const [notaryDate, setNotaryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [agreedPrice, setAgreedPrice] = useState(price == null ? "" : String(price));
  const [saleOpen, setSaleOpen] = useState(false);
  const [sellerId, setSellerId] = useState(user.id);
  const isAdmin = user.role === "ADMIN";
  const isOwner = optionedBy?.id === user.id;

  async function act(action: string, extra: Record<string, unknown> = {}, success = "İşlem tamamlandı") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiCall(`/api/crm/vehicles/${vehicleId}/transition`, { method: "POST", json: { action, ...extra } });
      setMessage(success);
      setSaleOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function archive() {
    const text =
      status === "AVAILABLE"
        ? "Bu ilan müşteri sitesinden kaldırılıp arşivlensin mi? Kayıt silinmez; yönetici geri yükleyebilir."
        : "Bu kayıt arşivlensin mi? Kayıt silinmez, araç listesinden kalkar; yönetici geri yükleyebilir.";
    if (confirm(text)) act("archive", {}, "Araç arşivlendi. Arşiv sekmesinden görülebilir.");
  }

  const sellable = status === "AVAILABLE" || status === "OPTIONED";

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
        {status === "REVIEW" && (
          <p className="rounded-md bg-violet-50 p-3 text-sm text-violet-900" data-testid="review-pending">
            Belgeden oluşturuldu: <strong>Kontrol Bekliyor</strong>. Belgeden okunan bilgileri kontrol edip onayladığınızda bu ekrandan yayımlayabilirsiniz.
          </p>
        )}
        {(status === "DRAFT" || status === "REVIEW") && (
          <>
            {status === "DRAFT" && <p className="text-sm text-amber-800">Bu araç taslak: müşteri sitesinde görünmüyor.</p>}
            {photoCount === 0 && <p className="text-sm text-amber-700">Yayımlamak için önce en az 1 fotoğraf yükleyin.</p>}
            <button disabled={busy} onClick={() => act("publish", {}, "Araç yayımlandı ve müşteri sitesinde görünüyor.")} className="btn-accent w-full py-3" data-testid="btn-publish">
              Onayla ve yayınla
            </button>
          </>
        )}

        {sellable && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => setSaleOpen((o) => !o)}
              aria-expanded={saleOpen}
              className="btn-accent w-full py-3 text-base"
              data-testid="btn-sold"
            >
              Satıldı
            </button>
            {saleOpen && (
              <div className="space-y-3 rounded-md border border-zinc-200 p-3" data-testid="sale-form">
                <div>
                  <label className="label" htmlFor="agreedPrice">Satış fiyatı (TL, isteğe bağlı)</label>
                  <input id="agreedPrice" inputMode="numeric" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value.replace(/\D/g, ""))} className="input" />
                </div>
                {staff.length > 1 && (
                  <div>
                    <label className="label" htmlFor="sellerId">Satan personel</label>
                    <select id="sellerId" value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="input">
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.id === user.id ? " (siz)" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="text-xs text-zinc-600">
                  Araç &quot;Satış Bekliyor&quot; olur ve sitede gizlenir. Noter devri tamamlanınca &quot;Satışı tamamla&quot; ile kesinleştirin.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(
                      "startSale",
                      { agreedPrice: agreedPrice ? Number(agreedPrice) : undefined, sellerId: sellerId !== user.id ? sellerId : undefined },
                      "Satış kaydedildi; ilan müşteri sitesinden gizlendi. Noter devri tamamlanınca 'Satışı tamamla' ile kesinleştirin.",
                    )
                  }
                  className="btn-primary w-full py-3"
                  data-testid="btn-start-sale"
                >
                  {busy ? "Kaydediliyor…" : "Satışı kaydet"}
                </button>
              </div>
            )}
          </>
        )}

        {status === "AVAILABLE" && (
          <>
            <button disabled={busy} onClick={() => act("option", {}, "Araç sizin adınıza opsiyonlandı.")} className="btn-outline w-full py-3" data-testid="btn-option">
              Opsiyonla
            </button>
            {isAdmin && (
              <button disabled={busy} onClick={() => confirm("Araç müşteri sitesinden kaldırılıp taslağa alınsın mı?") && act("unpublish", {}, "Araç yayından alındı; müşteri sitesinde artık görünmüyor.")} className="btn-outline w-full">
                Yayından al (taslağa çevir)
              </button>
            )}
          </>
        )}

        {status === "OPTIONED" && (isAdmin || isOwner) && (
          <button disabled={busy} onClick={() => act("releaseOption", {}, "Opsiyon kaldırıldı, araç yeniden satışta.")} className="btn-outline w-full" data-testid="btn-release">
            Opsiyonu kaldır ve satışa aç
          </button>
        )}

        {status === "SALE_PENDING" && (
          <>
            <p className="text-sm text-sky-900">Satış kaydedildi, noter devri bekleniyor. Araç sitede görünmüyor.</p>
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

        {status === "ARCHIVED" && (
          <>
            <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700" data-testid="archived-info">
              Bu kayıt arşivde: müşteri sitesinde görünmez ve düzenlenemez.{archivedInfo && <><br /><span className="text-xs text-zinc-500">Arşivleyen: {archivedInfo}</span></>}
            </p>
            {isAdmin ? (
              <button
                disabled={busy}
                onClick={() => confirm("Araç arşivden çıkarılıp Taslak olarak geri yüklensin mi? Yeniden yayın için normal kontroller gerekir.") && act("restore", {}, "Araç Taslak olarak geri yüklendi.")}
                className="btn-outline w-full"
                data-testid="btn-restore"
              >
                Arşivden geri yükle
              </button>
            ) : (
              <p className="text-xs text-zinc-500">Geri yükleme yalnızca yönetici yetkisindedir.</p>
            )}
          </>
        )}
      </div>

      {canArchive && (
        <button type="button" disabled={busy} onClick={archive} className="mt-3 w-full text-center text-sm text-zinc-600 hover:text-red-700 hover:underline" data-testid="btn-archive">
          Arşivle {status === "REVIEW" ? "(yanlış veya deneme kaydı)" : status === "AVAILABLE" ? "(ilanı kaldırır)" : ""}
        </button>
      )}
      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700" role="alert" data-testid="action-error">{error}</p>}
      {message && <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="action-message">{message}</p>}
    </section>
  );
}
