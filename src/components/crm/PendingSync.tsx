"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SaveError, useAutosave, type Changes } from "@/lib/client-autosave";
import { AutosaveBadge } from "./AutosaveBadge";

async function request(url: string, method: string, body: unknown, keepalive: boolean) {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive });
  } catch {
    throw new SaveError(navigator.onLine ? "Sunucuya ulaşılamadı" : "İnternet bağlantısı yok", true);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return { res, data };
}

/**
 * Formu olmayan adımlarda (fotoğraf, son kontrol): bu cihazda kaydedilmeyi bekleyen değişiklik varsa gönderir ve ekranı yeniler.
 * Böylece başka bölüme hızlı geçildiğinde son kontrol listesi eski bilgiyle hesaplanmaz.
 */
export function PendingSync({ vehicleId, version }: { vehicleId: string; version: string }) {
  const router = useRouter();
  const form = useAutosave({
    storageKey: vehicleId,
    save: async (changes: Changes, { keepalive }) => {
      const { res, data } = await request(`/api/crm/vehicles/${vehicleId}`, "PATCH", { ...changes, baseVersion: version }, keepalive);
      if (data.code === "DUPLICATE_PLATE") return {}; // plaka kararı 1. adımda verilir
      if (data.code === "STALE") throw new SaveError(`${data.error} Değişikliklerinizi görmek için 1. adımı açın`, false);
      if (!res.ok) throw new SaveError(data.error || `Kaydedilemedi (${res.status})`, res.status >= 500);
      return changes;
    },
  });
  const parts = useAutosave({
    storageKey: `kaporta:${vehicleId}`,
    save: async (changes: Changes, { keepalive }) => {
      const updates = Object.entries(changes).map(([part, c]) => ({ part, ...(c as object) }));
      const { res, data } = await request(`/api/crm/vehicles/${vehicleId}/parts`, "PUT", { updates }, keepalive);
      if (!res.ok) throw new SaveError(data.error || `Kaydedilemedi (${res.status})`, res.status >= 500);
      return changes;
    },
  });
  const had = useRef([form.restored, parts.restored].some((r) => r && Object.keys(r.changes).length > 0));
  const refreshed = useRef(false);
  useEffect(() => {
    if (!had.current || refreshed.current) return;
    if (form.status === "saved" || parts.status === "saved") {
      if (!form.hasPending() && !parts.hasPending()) {
        refreshed.current = true;
        router.refresh();
      }
    }
  }, [form, parts, router]);

  if (!had.current) return null;
  const bad = form.status === "error" ? form : parts.status === "error" ? parts : null;
  if (bad) return <AutosaveBadge status="error" error={bad.error} savedAt={null} onRetry={() => { void form.retry(); void parts.retry(); }} />;
  if (refreshed.current) return null;
  return <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600" role="status">Son değişiklikleriniz kaydediliyor…</p>;
}
