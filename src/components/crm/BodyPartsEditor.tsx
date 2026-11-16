"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BodyDiagram, BodyLegend } from "@/components/BodyDiagram";
import { BODY_PART_KEYS, BODY_PART_LABELS, PART_STATE_INFO, groupByState, partConflicts, summarizeParts, type BodyPartKey, type PartMap, type PartState } from "@/lib/body-parts";
import { apiCall } from "@/lib/client-api";
import { SaveError, useAutosave, type Changes } from "@/lib/client-autosave";
import { AutosaveBadge } from "./AutosaveBadge";

type Props = {
  vehicleId: string; staff: PartMap; report: PartMap; readOnly: boolean; lastUpdate: string | null;
  /** Sihirbazda: her dokunuş otomatik kaydedilir (ayrı "Kaydet" düğmesi yok; bölüm değişince değişiklik kaybolmaz). */
  autosave?: boolean;
};
type PartChange = { state: PartState; reportState: PartState };

/**
 * CRM kaporta şeması: personel beyanı ve ekspertiz raporu ayrı işaretlenir; çelişen parçalar kırmızı uyarıyla gösterilir.
 * Tüm parçalar "Bilinmiyor" başlar; AI parça durumu belirlemez.
 */
export function BodyPartsEditor({ vehicleId, staff: initialStaff, report: initialReport, readOnly, lastUpdate, autosave = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"state" | "reportState">("state");
  const [brush, setBrush] = useState<PartState>("PAINTED");
  const auto = useAutosave({
    storageKey: `kaporta:${vehicleId}`,
    enabled: autosave && !readOnly,
    save: async (changes: Changes) => {
      const updates = Object.entries(changes).map(([part, c]) => ({ part, ...(c as PartChange) }));
      try {
        await apiCall(`/api/crm/vehicles/${vehicleId}/parts`, { method: "PUT", json: { updates } });
      } catch (e) {
        if (e instanceof TypeError) throw new SaveError(navigator.onLine ? "Sunucuya ulaşılamadı" : "İnternet bağlantısı yok", true);
        throw new SaveError((e as Error).message, false);
      }
      return changes;
    },
  });
  // Cihazda kalmış (kaydedilememiş) parça değişiklikleri şemaya geri konur
  const restored = (autosave ? auto.restored?.changes : undefined) as Record<string, PartChange> | undefined;
  const [staff, setStaff] = useState<PartMap>(() => ({ ...initialStaff, ...Object.fromEntries(Object.entries(restored ?? {}).map(([k, c]) => [k, c.state])) }));
  const [report, setReport] = useState<PartMap>(() => ({ ...initialReport, ...Object.fromEntries(Object.entries(restored ?? {}).map(([k, c]) => [k, c.reportState])) }));
  const seen = useRef({ staff, report });
  useEffect(() => {
    if (!autosave) return;
    const diff: Changes = {};
    for (const k of BODY_PART_KEYS) {
      if (staff[k] !== seen.current.staff[k] || report[k] !== seen.current.report[k]) diff[k] = { state: staff[k], reportState: report[k] };
    }
    seen.current = { staff, report };
    if (Object.keys(diff).length) auto.queue(diff);
  }, [staff, report, autosave, auto.queue]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const current = mode === "state" ? staff : report;
  const conflicts = useMemo(() => partConflicts(staff, report), [staff, report]);
  const summary = summarizeParts(staff);
  const groups = groupByState(staff);
  const dirty = BODY_PART_KEYS.some((k) => staff[k] !== initialStaff[k] || report[k] !== initialReport[k]);

  const apply = (part: BodyPartKey) => {
    if (readOnly) return;
    const set = mode === "state" ? setStaff : setReport;
    set((m: PartMap) => ({ ...m, [part]: brush }));
    setMsg(null);
  };

  /**
   * Ekspertiz raporu önerilerini personel beyanına alır. Toplu alma yalnızca personelin henüz işaretlemediği (Bilinmiyor)
   * parçalara uygulanır: daha önce elle girilen değer ezilmez. Farklı olanlar tek tek alınabilir.
   */
  const reportKnown = BODY_PART_KEYS.filter((k) => report[k] !== "UNKNOWN");
  const adoptable = reportKnown.filter((k) => staff[k] === "UNKNOWN");
  const differing = reportKnown.filter((k) => staff[k] !== "UNKNOWN" && staff[k] !== report[k]);
  const adoptReport = () => {
    setStaff((m) => ({ ...m, ...Object.fromEntries(adoptable.map((k) => [k, report[k]])) }));
    setMode("state");
    setMsg({ ok: true, text: `${adoptable.length} parça rapordan alındı (önceden işaretlediğiniz parçalara dokunulmadı). ${autosave ? "Otomatik kaydediliyor." : "Kontrol edip kaydedin."}` });
  };
  const adoptOne = (k: BodyPartKey) => {
    setStaff((m) => ({ ...m, [k]: report[k] }));
    setMsg(null);
  };

  /** Kısayol: henüz işaretlenmemiş (Bilinmiyor) parçaları Orijinal yapar; yalnızca personel doğruladığını onaylarsa. */
  const markRestOriginal = () => {
    const current = mode === "state" ? staff : report;
    const rest = BODY_PART_KEYS.filter((k) => current[k] === "UNKNOWN");
    if (!rest.length) return;
    if (!confirm(`${rest.length} parça "Orijinal" olarak işaretlensin mi? Yalnızca ekspertizle veya kendiniz doğruladıysanız onaylayın.`)) return;
    (mode === "state" ? setStaff : setReport)((m) => ({ ...m, ...Object.fromEntries(rest.map((k) => [k, "ORIGINAL"])) }));
    setMsg({ ok: true, text: `${rest.length} parça Orijinal işaretlendi. ${autosave ? "Otomatik kaydediliyor." : "Kontrol edip kaydedin."}` });
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    const updates = BODY_PART_KEYS.filter((k) => staff[k] !== initialStaff[k] || report[k] !== initialReport[k]).map((k) => ({
      part: k,
      state: staff[k],
      reportState: report[k],
    }));
    try {
      await apiCall(`/api/crm/vehicles/${vehicleId}/parts`, { method: "PUT", json: { updates } });
      setMsg({ ok: true, text: "Kaporta bilgileri kaydedildi." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="kaporta" className="card rounded-xl p-5" data-testid="body-parts-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Kaporta şeması (boya / değişen)</h2>
          <p className="text-xs text-zinc-500">
            Her parça ayrı kaydedilir. Bilinmeyen parça &quot;Bilinmiyor&quot; kalır; &quot;Tüm parçalar orijinal&quot; yalnızca hepsi doğrulanınca gösterilir.
            {lastUpdate && <> · Son değişiklik: {lastUpdate}</>}
          </p>
        </div>
        <div className="flex rounded-lg bg-zinc-100 p-1 text-xs font-semibold" role="group" aria-label="İşaretleme kaynağı">
          {([["state", "Personel beyanı"], ["reportState", "Ekspertiz raporu"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} data-testid={`mode-${k}`}
              className={`rounded-md px-3 py-1.5 transition ${mode === k ? "bg-white text-ink shadow-sm" : "text-zinc-500"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className="mt-4">
          <p className="label">Uygulanacak durum — seçin, sonra şemada parçaya dokunun</p>
          <BodyLegend active={brush} onSelect={setBrush} />
          {BODY_PART_KEYS.some((k) => current[k] === "UNKNOWN") && (
            <button type="button" onClick={markRestOriginal} className="btn-outline mt-3 py-2 text-sm" data-testid="mark-rest-original">
              <span aria-hidden="true" className="text-emerald-600">✓</span>
              {BODY_PART_KEYS.every((k) => current[k] === "UNKNOWN") ? "Tamamı orijinal" : `Kalan ${BODY_PART_KEYS.filter((k) => current[k] === "UNKNOWN").length} parçayı orijinal işaretle`}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
        <BodyDiagram parts={current} onPartClick={readOnly ? undefined : apply} flagged={conflicts} />
        <div className="space-y-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
            {mode === "state" ? "Personel beyanı — sitede gösterilen" : "Ekspertiz raporundaki durum — yalnızca karşılaştırma için"}
          </p>
          <dl className="space-y-1.5" data-testid="body-summary">
            {summary.allOriginal ? (
              <p className="font-semibold text-emerald-700">Tüm parçalar orijinal (personel doğruladı)</p>
            ) : (
              ([["CHANGED", "Değişen"], ["PAINTED", "Boyalı"], ["LOCAL_PAINT", "Lokal boyalı"], ["UNKNOWN", "Bilinmiyor"]] as const).map(([s, label]) =>
                groups[s].length ? (
                  <div key={s}><dt className="inline font-bold">{label}: </dt><dd className="inline">{groups[s].join(", ")}</dd></div>
                ) : null,
              )
            )}
          </dl>
          {conflicts.length > 0 && (
            <p className="rounded-md bg-red-50 p-3 text-red-800" role="alert" data-testid="body-conflict">
              <strong>Ekspertiz raporuyla çelişki:</strong>{" "}
              {conflicts.map((k) => `${BODY_PART_LABELS[k]}`).join(", ")}. Personel beyanını rapor üzerinden kontrol edin.
            </p>
          )}
          {!readOnly && adoptable.length > 0 && (
            <button type="button" onClick={adoptReport} className="btn-outline w-full sm:w-auto" data-testid="adopt-report">
              Ekspertiz raporundaki {adoptable.length} parçayı personel beyanına aktar (işaretlenmemiş parçalar)
            </button>
          )}
          {!readOnly && reportKnown.length > 0 && (
            <ul className="space-y-1 text-xs" data-testid="report-suggestions">
              {reportKnown.map((k) => (
                <li key={k} className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-600">{BODY_PART_LABELS[k]}: rapor <strong>{PART_STATE_INFO[report[k]].label}</strong> · beyan <strong>{PART_STATE_INFO[staff[k]].label}</strong></span>
                  {staff[k] !== report[k] && (
                    <button type="button" onClick={() => adoptOne(k)} className="rounded border border-zinc-300 px-1.5 py-0.5 hover:border-zinc-500" data-testid={`adopt-${k}`}>
                      {differing.includes(k) ? "Rapordakini al (elle girileni değiştir)" : "Rapordakini al"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!readOnly && autosave && (
            <AutosaveBadge status={auto.status} error={auto.error} savedAt={auto.savedAt} onRetry={() => void auto.retry()} />
          )}
          {!readOnly && !autosave && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" disabled={busy || !dirty} onClick={save} className="btn-primary" data-testid="save-body-parts">
                {busy ? "Kaydediliyor…" : "Kaporta bilgilerini kaydet"}
              </button>
              {dirty && <span className="text-xs text-amber-700">Kaydedilmemiş değişiklik var</span>}
            </div>
          )}
          {msg && <p className={`rounded-md p-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</p>}
        </div>
      </div>
    </section>
  );
}
