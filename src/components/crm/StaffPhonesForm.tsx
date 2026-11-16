"use client";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";

type Row = { id: string; name: string; phone: string };

/** Yönetici: personelin WhatsApp numaraları. Asistan yalnız burada kayıtlı numaralara cevap verir. */
export function StaffPhonesForm({ users, assistantNumber }: { users: Row[]; assistantNumber: string | null }) {
  const [rows, setRows] = useState(users);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  return (
    <div className="card space-y-4 p-6" data-testid="staff-phones">
      <div>
        <h2 className="font-display text-lg font-bold">WhatsApp asistanı</h2>
        <p className="text-sm text-zinc-500">
          {assistantNumber ? <>Personel <b>{assistantNumber}</b> numarasına yazarak stok ve satış bilgisi sorabilir. </> : null}
          Asistan yalnız aşağıda numarası kayıtlı personele cevap verir; kayıt değiştirmez.
        </p>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(r.id);
                setMsg(null);
                try {
                  const res = await apiCall<{ ok: boolean; phone: string | null }>("/api/crm/users/phone", { method: "PUT", json: { userId: r.id, phone: r.phone } });
                  setRows((x) => x.map((y) => (y.id === r.id ? { ...y, phone: res.phone ?? "" } : y)));
                  setMsg({ id: r.id, ok: true, text: res.phone ? "Kaydedildi." : "Numara kaldırıldı." });
                } catch (err) {
                  setMsg({ id: r.id, ok: false, text: (err as Error).message });
                } finally {
                  setBusy(null);
                }
              }}
            >
              <label className="w-40 shrink-0 text-sm font-medium" htmlFor={`phone-${r.id}`}>{r.name}</label>
              <input
                id={`phone-${r.id}`} type="tel" inputMode="tel" placeholder="0532 123 45 67" value={r.phone}
                onChange={(e) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, phone: e.target.value } : y)))}
                className="input min-w-0 flex-1"
              />
              <button type="submit" disabled={busy === r.id} className="btn-outline py-2 text-xs">Kaydet</button>
              {msg?.id === r.id && <span className={`w-full text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
