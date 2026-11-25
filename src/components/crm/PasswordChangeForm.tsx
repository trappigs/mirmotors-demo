"use client";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";

/** Kendi şifresini değiştirme: geçici şifreyle ilk girişte zorunlu, Ayarlar'dan da açılır. */
export function PasswordChangeForm({ forced, next = "/crm" }: { forced: boolean; next?: string }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw !== pw2) return setError("Yeni şifreler birbiriyle aynı değil.");
    setBusy(true);
    try {
      await apiCall("/api/crm/account/password", { method: "POST", json: { current, next: pw } });
      setDone(true);
      window.location.href = next;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="password-form">
      <div>
        <label className="label" htmlFor="current">{forced ? "Size verilen geçici şifre" : "Mevcut şifre"}</label>
        <input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="new-password">Yeni şifre</label>
        <input id="new-password" type="password" autoComplete="new-password" required minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} className="input" />
        <p className="mt-1 text-xs text-zinc-500">En az 10 karakter; en az bir harf ve bir rakam.</p>
      </div>
      <div>
        <label className="label" htmlFor="new-password-2">Yeni şifre (tekrar)</label>
        <input id="new-password-2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} className="input" />
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {done && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Şifreniz değiştirildi.</p>}
      <button disabled={busy} className="btn-primary w-full py-3">{busy ? "Kaydediliyor…" : "Şifreyi değiştir"}</button>
      {!forced && <p className="text-xs text-zinc-500">Şifre değişince diğer cihazlardaki oturumlarınız kapanır.</p>}
    </form>
  );
}
