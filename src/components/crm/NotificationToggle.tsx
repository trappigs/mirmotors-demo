"use client";
import { useEffect, useState } from "react";
import { apiCall } from "@/lib/client-api";

type State =
  | "loading"
  | "unsupported" // tarayıcı desteklemiyor
  | "ios-home" // iPhone: önce Ana Ekrana eklenmeli
  | "not-configured" // sunucuda VAPID anahtarları yok
  | "denied" // kullanıcı tarayıcıda engellemiş
  | "off"
  | "on";

const SW_URL = "/sw.js";
const SW_SCOPE = "/crm/";

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function existingSubscription() {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * Bu cihazda personel bildirimlerini açar/kapatır. İzin yalnızca kullanıcı butona dokununca istenir.
 * Bildirimler: opsiyon, opsiyon kaldırma, satış tamamlama ve yeni ilan (işlemi yapan kişiye gönderilmez).
 */
export function NotificationToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (!cancelled) setState(isIos() && !isStandalone() ? "ios-home" : "unsupported");
        return;
      }
      try {
        const info = await apiCall<{ configured: boolean; publicKey: string | null }>("/api/crm/push");
        if (cancelled) return;
        setPublicKey(info.publicKey);
        if (!info.configured || !info.publicKey) return setState("not-configured");
        if (Notification.permission === "denied") return setState("denied");
        const sub = await existingSubscription();
        if (!cancelled) setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setState("off");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      await apiCall("/api/crm/push/subscribe", { method: "POST", json: sub.toJSON() });
      setState("on");
    } catch (e) {
      setError((e as Error).message || "Bildirimler açılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const sub = await existingSubscription();
      if (sub) {
        await apiCall("/api/crm/push/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const text: Record<State, string> = {
    loading: "Kontrol ediliyor…",
    unsupported: "Bu tarayıcı bildirimleri desteklemiyor.",
    "ios-home": "iPhone'da bildirim için önce Safari'de Paylaş → Ana Ekrana Ekle ile CRM'i ekleyin ve oradan açın (iOS 16.4 ve üzeri).",
    "not-configured": "Bildirim altyapısı hazır, sunucu anahtarları henüz tanımlanmadı.",
    denied: "Bildirimler bu cihazda engellenmiş. Açmak için tarayıcı / telefon ayarlarından bu siteye izin verin.",
    off: "Opsiyon, satış ve yeni ilan olduğunda bu cihaza bildirim gelir.",
    on: "Bu cihazda bildirimler açık.",
  };

  return (
    <section className={compact ? "text-sm" : "card p-5"} data-testid="notification-toggle">
      {!compact && <h2 className="font-semibold">Bildirimler</h2>}
      <p className={`${compact ? "" : "mt-2 "}text-sm text-zinc-600`}>{text[state]}</p>
      {state === "off" && (
        <button type="button" disabled={busy || !publicKey} onClick={enable} className="btn-primary mt-3" data-testid="btn-notifications-on">
          {busy ? "Açılıyor…" : "Bildirimleri aç"}
        </button>
      )}
      {state === "on" && (
        <button type="button" disabled={busy} onClick={disable} className="btn-outline mt-3" data-testid="btn-notifications-off">
          {busy ? "Kapatılıyor…" : "Bu cihazda kapat"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    </section>
  );
}
