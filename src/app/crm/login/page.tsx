"use client";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiCall("/api/auth/login", { method: "POST", json: { email, password } });
      window.location.href = "/crm";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <p className="font-display text-xl font-bold tracking-[0.2em]">MIR <span className="font-light text-accent-dark">MOTORS</span></p>
        <h1 className="mt-6 text-lg font-semibold">Personel girişi</h1>
        <p className="text-sm text-zinc-500">Galeri CRM · Demo</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">E-posta</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Şifre</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </div>
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="btn-primary w-full py-3">{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button>
        </div>
        <p className="mt-6 text-xs text-zinc-400">Demo hesapları README.md dosyasında listelenmiştir.</p>
      </form>
    </div>
  );
}
