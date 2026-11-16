"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";
import type { CompanyInfo } from "@/lib/listing-rules";

type Values = { title: string; authorizationNo: string; mersis: string; address: string };
const FIELDS: [keyof Values, string, string][] = [
  ["title", "Resmî ad / ticaret unvanı", "Yetki belgesinde yazan ad veya ticaret unvanı (marka adından farklıysa resmî olanı yazın)"],
  ["authorizationNo", "İkinci el taşıt yetki belgesi no", "Ticaret Bakanlığı yetki belgesindeki numara"],
  ["mersis", "MERSİS no (isteğe bağlı)", ""],
  ["address", "Showroom adresi", "Sitenin alt bilgisinde görünür"],
];

export function CompanySettingsForm({ initial, fallback }: { initial: Values; fallback: CompanyInfo }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="card space-y-4 p-6"
      data-testid="company-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await apiCall("/api/crm/settings", { method: "PUT", json: v });
          setMsg({ ok: true, text: "Kaydedildi. Bilgiler tüm ilanlarda güncellendi." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      {FIELDS.map(([k, label, hint]) => (
        <div key={k}>
          <label className="label" htmlFor={k}>{label}</label>
          <input id={k} className="input" value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} />
          {(hint || (!v[k] && fallback[k])) && (
            <p className="mt-1 text-xs text-zinc-500">{hint}{!v[k] && fallback[k] ? ` · Şu an kullanılan: ${fallback[k]}` : ""}</p>
          )}
        </div>
      ))}
      {msg && <p className={`rounded-md p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <button disabled={busy} className="btn-primary">{busy ? "Kaydediliyor…" : "Kaydet"}</button>
    </form>
  );
}
