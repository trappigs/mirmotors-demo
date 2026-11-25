"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";
import { DOC_KIND_LABELS, reviewBlockers, type DocReview } from "@/lib/doc-review";
import { aiFieldTarget, fixHref } from "@/lib/fix-targets";

const DOC = DOC_KIND_LABELS;

/**
 * Belgeden oluşturulan aracın kontrol paneli. AI'nın doldurduğu hiçbir alan kendiliğinden "doğrulanmış" sayılmaz;
 * personel çelişkileri çözer, eşleşmeyi onaylar ve bilgileri kontrol ettiğini onaylar. Ayrı bir "kontrolü tamamla" adımı yoktur:
 * hepsi çözülünce araç son kontrol ekranından tek onayla yayımlanır (sunucu aynı koşulları yeniden denetler).
 * filled: okunamayan alanlardan personelin sonradan doldurdukları (listede "tamamlandı" görünür).
 */
export function DocReviewPanel({ vehicleId, review, status, readOnly, filled = [], fixLinks = false }: {
  vehicleId: string; review: DocReview; status: string; readOnly: boolean; filled?: string[]; fixLinks?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const blockers = reviewBlockers(review);
  // AI'nın okuyup emin olamadığı alanlar: A listesinde turuncu etiket, B'de ayrı başlık
  const uncertain = review.uncertain ?? [];
  const unsureOf = (field: string) => uncertain.find((u) => u.field === field);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      await apiCall(`/api/crm/vehicles/${vehicleId}/review`, { method: "POST", json: body });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const identityTone = review.identity === "DIFFERENT" ? "border-red-300 bg-red-50 text-red-900" : review.identity === "REVIEW" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900";
  return (
    <section id="belge-kontrolu" className="card space-y-5 rounded-xl border-violet-300 p-5" data-testid="doc-review">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Belgeden okunan bilgiler {blockers.length ? <span className="ml-1 rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800">Kontrol bekliyor</span> : <span className="ml-1 text-xs font-normal text-emerald-700">kontrol edildi</span>}</h2>
          <p className="text-xs text-zinc-500">AI&apos;nın okuduğu bilgiler siz onaylayana kadar &quot;doğrulanmış&quot; sayılmaz. Aşağıdaki konuları çözün; okunamayan bilgileri &quot;Düzelt&quot; ile girin.</p>
        </div>
      </div>

      <div className={`rounded-lg border p-3 text-sm ${identityTone}`} data-testid="doc-identity" data-identity={review.identity}>
        <p className="font-semibold">
          {review.identity === "SAME" && "Belgeler aynı araca ait"}
          {review.identity === "SINGLE" && "Tek belge türü okundu"}
          {review.identity === "REVIEW" && (review.identityResolved ? "Aynı araç olduğu personelce onaylandı" : "Aynı araç olduğu doğrulanmalı")}
          {review.identity === "DIFFERENT" && (review.identityResolved ? "Farklı araca ait ekspertiz ayrıldı" : "Belgeler FARKLI araçlara ait görünüyor")}
        </p>
        <p className="mt-0.5">{review.identityNote}</p>
        {!readOnly && !review.identityResolved && (
          <div className="mt-2 flex flex-wrap gap-2">
            {review.identity === "REVIEW" && <button type="button" disabled={busy} onClick={() => act({ action: "confirmIdentity" })} className="btn-outline bg-white py-1.5 text-xs" data-testid="confirm-identity">Aynı araç, onaylıyorum</button>}
            <button type="button" disabled={busy} onClick={() => act({ action: "detachEkspertiz" })} className="btn-outline bg-white py-1.5 text-xs text-red-700" data-testid="detach-ekspertiz">Ekspertizi bu araçtan ayır</button>
          </div>
        )}
      </div>

      {review.stockDuplicates.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="doc-duplicates">
          <p className="font-semibold">Stokta aynı plaka/şasiye sahip kayıt var</p>
          <ul className="mt-1 list-inside list-disc">
            {review.stockDuplicates.map((d) => <li key={d.id}><Link className="underline" href={`/crm/vehicles/${d.id}`}>{d.title}</Link> · {d.match} · {d.status}</li>)}
          </ul>
          {!readOnly && !review.duplicatesAcknowledged && <button type="button" disabled={busy} onClick={() => act({ action: "ackDuplicates" })} className="btn-outline mt-2 bg-white py-1.5 text-xs" data-testid="ack-duplicates">İnceledim, bu ayrı bir kayıt</button>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div data-testid="doc-group-a">
          <h3 className="text-sm font-semibold">A · Belgede tespit edilen bilgiler</h3>
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {review.aiFields.length === 0 && <li className="py-1.5 text-zinc-500">Bilgi okunamadı.</li>}
            {review.aiFields.map((f) => {
              const u = unsureOf(f.field);
              return (
                <li key={f.field} className={`py-1.5 ${u ? "-mx-1 rounded bg-amber-50 px-1" : ""}`} data-unsure={u ? "1" : undefined}>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">{f.label}</span>
                    <span className="text-right font-medium">
                      {f.value}{" "}
                      {u && !review.aiConfirmed
                        ? <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-900">AI · emin değil</span>
                        : <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-bold text-sky-700">{review.aiConfirmed ? "AI · kontrol edildi" : "AI · onaylanmadı"}</span>}
                    </span>
                  </div>
                  {u && <p className="text-[11px] font-medium text-amber-800">AI: {u.reason}</p>}
                  <p className="text-[11px] text-zinc-400">{DOC[f.document]}{f.page ? ` · sayfa ${f.page}` : ""}{f.location ? ` · ${f.location}` : ""}{f.evidence ? ` · “${f.evidence}”` : ""}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-4">
          {uncertain.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3" data-testid="doc-group-unsure">
              <h3 className="text-sm font-semibold text-amber-950">AI&apos;nın emin olmadığı bilgiler ({uncertain.length})</h3>
              <p className="text-xs text-amber-900">Bu değerler okundu ama net değil. Belgenin aslıyla karakter karakter karşılaştırın; yanlışsa düzeltin.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {uncertain.map((u) => (
                  <li key={u.field} className="flex flex-wrap items-baseline justify-between gap-2" data-uncertain={u.field}>
                    <span><strong>{u.label}:</strong> <span className="text-amber-900">{u.reason}</span></span>
                    {fixLinks && !readOnly && <Link href={fixHref(vehicleId, aiFieldTarget(u.field))} className="btn-outline bg-white px-3 py-1 text-xs">Kontrol et</Link>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div data-testid="doc-group-b">
            <h3 className="text-sm font-semibold">B · Eksik veya belirsiz bilgiler</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {review.missing.length === 0 && <li className="text-zinc-500">Yok.</li>}
              {review.missing.map((m) => {
                const done = filled.includes(m.field);
                return (
                  <li key={m.field} className="flex flex-wrap items-baseline justify-between gap-2" data-missing={m.field} data-filled={done ? "1" : "0"}>
                    <span className={done ? "text-zinc-400 line-through" : ""}><strong>{m.label}:</strong> <span className={done ? "" : "text-zinc-600"}>{m.reason}</span></span>
                    {done ? <span className="text-xs text-emerald-700">✓ girildi</span>
                      : fixLinks && !readOnly && <Link href={fixHref(vehicleId, aiFieldTarget(m.field))} className="btn-outline px-3 py-1 text-xs">Düzelt</Link>}
                  </li>
                );
              })}
            </ul>
          </div>
          <div data-testid="doc-group-c">
            <h3 className="text-sm font-semibold">C · Çelişkili bilgiler</h3>
            {review.conflicts.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Çelişki yok.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {review.conflicts.map((c) => {
                  const [la, lb] = c.labels ?? ["Ruhsat", "Ekspertiz"];
                  const vinLocked = c.field === "vinLast6" && review.identity === "DIFFERENT";
                  return (
                    <li key={`${c.field}-${c.ruhsat}-${c.ekspertiz}`} className="rounded-md border border-zinc-200 p-2" data-testid={`conflict-${c.field}`}>
                      <p className="font-medium">{c.label} {c.resolved && <span className="text-xs font-normal text-emerald-700">· çözüldü ({c.resolved === "MANUAL" ? "elle" : c.resolved === "RUHSAT" ? la : lb})</span>}</p>
                      {!readOnly && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {([["RUHSAT", la, c.ruhsat], ["EKSPERTIZ", lb, c.ekspertiz]] as const).map(([k, l, val]) => (
                            <button key={k} type="button" disabled={busy || vinLocked} onClick={() => act({ action: "resolveConflict", field: c.field, choice: k })}
                              className={`rounded-md border px-2 py-1 text-xs ${c.resolved === k ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white hover:border-zinc-500"} disabled:opacity-50`}>
                              {l}: <strong>{val}</strong>
                            </button>
                          ))}
                          <button type="button" disabled={busy} onClick={() => act({ action: "resolveConflict", field: c.field, choice: "MANUAL" })}
                            className={`rounded-md border px-2 py-1 text-xs ${c.resolved === "MANUAL" ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white"}`}>Elle gireceğim</button>
                        </div>
                      )}
                      {vinLocked && <p className="mt-1 text-xs text-red-700">Şasi uyuşmazlığında belge değeri seçilemez; ekspertizi ayırın veya şasiyi elle doğrulayın.</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {(review.findings.engine || review.findings.mechanical || review.findings.electrical || review.findings.important.length > 0) && (
        <div className="text-sm" data-testid="doc-findings">
          <h3 className="font-semibold">Ekspertiz bulguları</h3>
          {review.findings.engine && <p><strong>Motor:</strong> {review.findings.engine}</p>}
          {review.findings.mechanical && <p><strong>Mekanik:</strong> {review.findings.mechanical}</p>}
          {review.findings.electrical && <p><strong>Elektrik / elektronik:</strong> {review.findings.electrical}</p>}
          {review.findings.important.map((w) => <p key={w}>⚠ {w}</p>)}
        </div>
      )}
      {review.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-800" data-testid="doc-warnings">{review.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>
      )}

      {review.ownerCheckRequired && (
        <div className="rounded-lg border border-zinc-200 p-3 text-sm">
          <p className="font-semibold">Tescil sahibi (işletme adına mı?) {review.ownerChecked && <span className="text-xs font-normal text-emerald-700">· kontrol edildi</span>}</p>
          <p className="text-xs text-zinc-500">Belgeden kesin anlaşılamadı. Ruhsatın aslına bakarak seçin; sistem bu bilgiden otomatik hukuki karar vermez.</p>
          {!readOnly && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([[true, "İşletme adına tescilli"], [false, "İşletme adına değil"]] as const).map(([val, label]) => (
                <button key={label} type="button" disabled={busy} onClick={() => act({ action: "ownerChecked", value: val })} className="btn-outline py-1.5 text-xs">{label}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="space-y-3 border-t border-zinc-100 pt-4">
          <label className="flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" className="mt-0.5" checked={review.aiConfirmed} disabled={busy} onChange={(e) => act({ action: "confirmAi", value: e.target.checked })} data-testid="confirm-ai" />
            AI&apos;nın doldurduğu bilgileri belgelerle karşılaştırdım{uncertain.length > 0 ? <> (özellikle turuncu işaretli {uncertain.length} bilgiyi)</> : null}; yanlış olanları araç formunda düzelttim.
          </label>
          {blockers.length > 0 && (
            <ul className="list-inside list-disc text-sm text-amber-800" data-testid="review-blockers">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          )}
          {blockers.length === 0 && (
            <p className="text-sm text-emerald-700" data-testid="review-done">✓ Belge kontrolü tamam{status === "REVIEW" ? "; diğer eksikler de tamamlanınca “Onayla ve yayınla” ile yayımlayabilirsiniz." : "."}</p>
          )}
        </div>
      )}
      {msg && <p className={`rounded-md p-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`} role="status">{msg.text}</p>}
    </section>
  );
}
