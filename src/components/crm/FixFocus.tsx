"use client";
import { useEffect } from "react";

/**
 * "Düzelt" bağlantısıyla gelinen alanı (#alan) bulur: kapalı bölümü açar, alanı ekranın ortasına getirir, odaklar ve kısa süre vurgular.
 * Alan henüz çizilmemişse (ör. ruhsat özet kartı açılıyor) birkaç kez yeniden dener.
 */
export function FixFocus() {
  useEffect(() => {
    let cancelled = false;
    const go = (tries = 0) => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || cancelled) return;
      const el = document.getElementById(id);
      if (!el) {
        if (tries < 10) setTimeout(() => go(tries + 1), 100);
        return;
      }
      if (el instanceof HTMLDetailsElement) el.open = true;
      for (let p = el.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      if (el.matches("input, select, textarea, button")) (el as HTMLElement).focus({ preventScroll: true });
      el.classList.add("ring-2", "ring-red-400", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-2", "ring-red-400", "ring-offset-2"), 2500);
    };
    const onHash = () => go();
    setTimeout(() => go(), 50);
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  return null;
}
