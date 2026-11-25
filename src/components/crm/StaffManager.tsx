"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiCall } from "@/lib/client-api";

export type StaffRow = {
  id: string; name: string; email: string; role: "ADMIN" | "SALES"; phone: string; active: boolean;
  lastLogin: string | null; mustChangePassword: boolean;
};
type Draft = { name: string; email: string; role: "ADMIN" | "SALES"; phone: string };
const EMPTY: Draft = { name: "", email: "", role: "SALES", phone: "" };
const ROLE: Record<Draft["role"], string> = { ADMIN: "Yönetici", SALES: "Satış personeli" };

/** Ayarlar > Personel (yalnızca yönetici): ekle, düzenle, pasif/aktif yap, şifre sıfırla. */
export function StaffManager({ staff, meId }: { staff: StaffRow[]; meId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassive, setShowPassive] = useState(false);

  const active = staff.filter((s) => s.active);
  const passive = staff.filter((s) => !s.active);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const r = await apiCall<{ tempPassword: string }>("/api/crm/staff", { method: "POST", json: draft });
      setSecret({ name: draft.name, email: draft.email.trim().toLowerCase(), password: r.tempPassword });
      setCopied(false);
      setAdding(false);
      setDraft(EMPTY);
    });
  const patch = (s: StaffRow, body: Record<string, unknown>) =>
    run(async () => {
      const r = await apiCall<{ tempPassword?: string }>(`/api/crm/staff/${s.id}`, { method: "PATCH", json: body });
      if (r.tempPassword) {
        setSecret({ name: s.name, email: s.email, password: r.tempPassword });
        setCopied(false);
      }
      setEditing(null);
    });

  const form = (onSave: () => void, saveLabel: string, onCancel: () => void, self = false) => (
    <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 sm:grid-cols-2" data-testid="staff-form">
      <div>
        <label className="label" htmlFor="staff-name">Ad soyad</label>
        <input id="staff-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="staff-email">E-posta (giriş için)</label>
        <input id="staff-email" type="email" autoComplete="off" className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="staff-phone">Cep telefonu (isteğe bağlı)</label>
        <input id="staff-phone" inputMode="tel" placeholder="05XX XXX XX XX" className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        <p className="mt-1 text-xs text-zinc-500">WhatsApp&apos;tan yazdığında personelin tanınması için.</p>
      </div>
      <div>
        <p className="label">Yetki</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Yetki">
          {(["SALES", "ADMIN"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={draft.role === r}
              disabled={self && r === "SALES"}
              onClick={() => setDraft({ ...draft, role: r })}
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-40 ${draft.role === r ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}
            >
              {ROLE[r]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-500">Yönetici: ayarlar, personel ve tüm araçlar. Satış personeli: araç ekleme ve satış.</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="button" disabled={busy} onClick={onSave} className="btn-primary">{busy ? "Kaydediliyor…" : saveLabel}</button>
        <button type="button" disabled={busy} onClick={onCancel} className="btn-outline">Vazgeç</button>
      </div>
    </div>
  );

  const row = (s: StaffRow) => {
    const me = s.id === meId;
    if (editing === s.id) {
      return <li key={s.id} className="py-3">{form(() => patch(s, { action: "update", ...draft }), "Kaydet", () => setEditing(null), me)}</li>;
    }
    return (
      <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-testid="staff-row">
        <div className="min-w-0">
          <p className="font-semibold">
            {s.name}
            {me && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">Siz</span>}
            <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${s.role === "ADMIN" ? "bg-accent/15 text-accent-dark" : "bg-zinc-100 text-zinc-600"}`}>{ROLE[s.role]}</span>
            {!s.active && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">Pasif</span>}
          </p>
          <p className="text-sm text-zinc-600">{s.email}{s.phone && ` · ${s.phone}`}</p>
          <p className="text-xs text-zinc-400">
            {s.mustChangePassword ? "Henüz kendi şifresini belirlemedi" : s.lastLogin ? `Son giriş ${s.lastLogin}` : "Henüz giriş yapmadı"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.active && (
            <button type="button" disabled={busy} className="btn-outline py-1.5 text-xs"
              onClick={() => { setEditing(s.id); setAdding(false); setDraft({ name: s.name, email: s.email, role: s.role, phone: s.phone }); }}>
              Düzenle
            </button>
          )}
          {s.active && !me && (
            <button type="button" disabled={busy} className="btn-outline py-1.5 text-xs"
              onClick={() => confirm(`${s.name} için yeni geçici şifre oluşturulsun mu? Açık oturumları kapanır.`) && patch(s, { action: "resetPassword" })}>
              Şifre sıfırla
            </button>
          )}
          {s.active && !me && (
            <button type="button" disabled={busy} className="btn-outline border-red-200 py-1.5 text-xs text-red-700 hover:border-red-400" data-testid="staff-deactivate"
              onClick={() => confirm(`${s.name} pasif yapılsın mı?\n\nHemen tüm cihazlarda oturumu kapanır ve giriş yapamaz. Eklediği araçlar ve geçmişi korunur; istediğinizde yeniden aktif yapabilirsiniz.`) && patch(s, { action: "deactivate" })}>
              Pasif yap
            </button>
          )}
          {!s.active && (
            <button type="button" disabled={busy} className="btn-outline py-1.5 text-xs" onClick={() => patch(s, { action: "activate" })}>
              Yeniden aktif yap
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="card space-y-4 p-6" data-testid="staff-manager">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Personel</h2>
          <p className="text-sm text-zinc-500">{active.length} aktif personel{passive.length ? ` · ${passive.length} pasif` : ""}</p>
        </div>
        {!adding && (
          <button type="button" className="btn-primary" onClick={() => { setAdding(true); setEditing(null); setDraft(EMPTY); setError(""); }}>
            + Yeni personel
          </button>
        )}
      </div>

      {secret && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4" data-testid="temp-password">
          <p className="font-semibold text-emerald-900">{secret.name} için geçici şifre</p>
          <p className="mt-2 select-all rounded-lg bg-white px-3 py-2 font-mono text-lg tracking-wide">{secret.password}</p>
          <p className="mt-2 text-sm text-emerald-900">
            Bu şifre <strong>bir daha gösterilmez</strong>. Personele kendiniz iletin; ilk girişte kendi şifresini belirlemesi istenir.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline bg-white py-1.5 text-xs"
              onClick={async () => {
                await navigator.clipboard?.writeText(`Mir Motors personel girişi\nAdres: ${location.origin}/crm/login\nE-posta: ${secret.email}\nGeçici şifre: ${secret.password}\nİlk girişte kendi şifrenizi belirleyeceksiniz.`);
                setCopied(true);
              }}
            >
              {copied ? "Kopyalandı ✓" : "Giriş bilgilerini kopyala"}
            </button>
            <button type="button" className="btn-outline bg-white py-1.5 text-xs" onClick={() => setSecret(null)}>Kapat</button>
          </div>
        </div>
      )}

      {adding && form(create, "Personeli ekle", () => setAdding(false))}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      <ul className="divide-y divide-zinc-100">{active.map(row)}</ul>

      {passive.length > 0 && (
        <div>
          <button type="button" className="text-sm font-semibold text-zinc-600 hover:text-ink" onClick={() => setShowPassive((x) => !x)}>
            {showPassive ? "▾" : "▸"} Pasif personel ({passive.length})
          </button>
          {showPassive && <ul className="mt-2 divide-y divide-zinc-100">{passive.map(row)}</ul>}
        </div>
      )}
    </section>
  );
}
