"use client";
// Otomatik taslak kaydı (tarayıcı): değişen alanlar kısa bir beklemeden sonra sunucuya gönderilir.
// Gönderilemeyen değişiklikler cihazda (localStorage) saklanır; bağlantı gelince veya sayfa yeniden açılınca tekrar denenir.
import { useCallback, useEffect, useRef, useState } from "react";

export type Changes = Record<string, unknown>;
export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "held";

const PREFIX = "mm-taslak:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const RETRY_MS = 8000;

type Stored = { at: number; changes: Changes; meta?: Record<string, unknown> };

/** Cihazdaki kaydedilmemiş değişiklikler (14 günden eskiyse yok sayılır). Gizli sekme / kapalı depolama hata vermez. */
export function readLocalDraft(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s !== "object" || Date.now() - s.at > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function writeLocalDraft(key: string, changes: Changes, meta?: Record<string, unknown>) {
  try {
    if (!Object.keys(changes).length && !meta) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), changes, meta } satisfies Stored));
  } catch {
    /* depolama kapalı: yalnızca sunucu kaydı kullanılır */
  }
}

export const clearLocalDraft = (key: string) => {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* yok say */
  }
};

/** Kaydetme hatası. retry=false: aynı veriyle tekrar denemek işe yaramaz (ör. geçersiz değer); personel düzeltene kadar beklenir. */
export class SaveError extends Error {
  constructor(message: string, public retry: boolean) {
    super(message);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * save(changes) gönderdiği alanları döndürür (bir kısmını bekletebilir, ör. onay bekleyen plaka).
 * Dönen alanlar bekleyenlerden düşülür; o arada aynı alan yeniden değiştiyse yeni değer bekler.
 */
export function useAutosave({ storageKey, save, delay = 1500, enabled = true }: {
  storageKey: string;
  save: (changes: Changes, opts: { keepalive: boolean }) => Promise<Changes>;
  delay?: number;
  enabled?: boolean;
}) {
  const keyRef = useRef(storageKey);
  const pending = useRef<Changes>({});
  const metaRef = useRef<Record<string, unknown> | undefined>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // Açılışta cihazda bulunan (önceki oturumdan kalmış) kaydedilmemiş değişiklikler
  const [restored] = useState<Stored | null>(() => (typeof window === "undefined" ? null : readLocalDraft(storageKey)));

  const persist = useCallback(() => writeLocalDraft(keyRef.current, pending.current, metaRef.current), []);

  const run = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (busy.current) {
      again.current = true;
      return false;
    }
    const snapshot = { ...pending.current };
    if (!Object.keys(snapshot).length) {
      setStatus((s) => (s === "pending" ? "saved" : s));
      return true;
    }
    busy.current = true;
    setStatus("saving");
    try {
      const sent = await saveRef.current(snapshot, { keepalive: false });
      for (const [k, val] of Object.entries(sent)) if (same(pending.current[k], val)) delete pending.current[k];
      persist();
      setError("");
      if (Object.keys(sent).length) setSavedAt(new Date());
      const left = Object.keys(pending.current).length;
      // Hiçbir alan gönderilemediyse (hepsi personel kararı bekliyor) döngüye girmeden beklenir
      setStatus(left ? (Object.keys(sent).length ? "pending" : "held") : "saved");
      if (left && Object.keys(sent).length) again.current = true;
      return left === 0;
    } catch (e) {
      const err = e instanceof SaveError ? e : new SaveError(navigator.onLine ? "Sunucuya ulaşılamadı" : "İnternet bağlantısı yok", true);
      setError(err.message);
      setStatus("error");
      if (err.retry && !timer.current) timer.current = setTimeout(() => void run(), RETRY_MS);
      return false;
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        if (!timer.current) timer.current = setTimeout(() => void run(), 0);
      }
    }
  }, [persist]);

  /** Değişikliği bekleyenlere ekler, cihaza yazar ve kısa beklemeden sonra kaydeder. */
  const queue = useCallback((changes: Changes) => {
    Object.assign(pending.current, changes);
    persist();
    if (!enabled) return;
    setStatus("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), delay);
  }, [persist, run, delay, enabled]);

  /** Bekleyen her şeyi hemen kaydetmeyi dener (sonraki adıma geçmeden önce). */
  const flush = useCallback(async () => {
    for (let i = 0; busy.current && i < 50; i++) await new Promise((r) => setTimeout(r, 200));
    return run();
  }, [run]);

  /** Kayıt anahtarını değiştirir (yeni giriş → oluşturulan aracın kimliği); bekleyenler yeni anahtara taşınır. */
  const rekey = useCallback((next: string) => {
    if (next === keyRef.current) return;
    clearLocalDraft(keyRef.current);
    keyRef.current = next;
    persist();
  }, [persist]);

  const setMeta = useCallback((meta: Record<string, unknown> | undefined) => {
    metaRef.current = meta;
    persist();
  }, [persist]);

  const hasPending = () => Object.keys(pending.current).length > 0;

  useEffect(() => {
    if (!enabled) return;
    // Önceki oturumdan kalan değişiklikler kaydedilmeyi bekliyor
    if (restored && Object.keys(restored.changes).length) {
      Object.assign(pending.current, restored.changes);
      metaRef.current = restored.meta;
      setStatus("pending");
      timer.current = setTimeout(() => void run(), 300);
    }
    const online = () => void run();
    // Sayfa kapanırken / arka plana geçerken bekleyenler son bir kez gönderilir (keepalive: sayfa kapansa da istek tamamlanır)
    const leave = () => {
      if (!Object.keys(pending.current).length) return;
      persist();
      void saveRef.current({ ...pending.current }, { keepalive: true })
        .then((sent) => {
          for (const [k, val] of Object.entries(sent)) if (same(pending.current[k], val)) delete pending.current[k];
          persist();
        })
        .catch(() => {});
    };
    const onHide = () => document.visibilityState === "hidden" && leave();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      // Bölüm değişirken (bileşen kapanırken) bekleyenler gönderilir; cihazdaki kopya başarıya kadar kalır
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { status, error, savedAt, restored, queue, flush, rekey, setMeta, hasPending, retry: run };
}
