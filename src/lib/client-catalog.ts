"use client";
import { useEffect, useState } from "react";
import { BRAND_MODELS } from "./constants";

/** marka → seri → { tur, motorlar, paketler (motor → paket adları) } */
export type VehicleCatalog = Record<string, Record<string, { tur: string | null; motorlar: string[]; paketler?: Record<string, string[]> }>>;

/** Katalog dosyası (src/data/arac-katalogu.json) her değiştiğinde artırılır: tarayıcı önbelleğindeki eski liste kullanılmaz. */
const CATALOG_VERSION = 2; // yalnızca katalog dosyası değişince artır
let cache: Promise<VehicleCatalog> | null = null;
/** Katalog sayfa başına bir kez indirilir; ağ hatasında boş katalogla devam edilir (öneriler yalnızca kolaylık). */
function loadCatalog(): Promise<VehicleCatalog> {
  cache ??= fetch(`/api/crm/katalog?v=${CATALOG_VERSION}`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => {
      cache = null;
      return {};
    });
  return cache;
}

type GalleryItem = { brand: string; model: string | null; packageName: string | null };
/** Galeride daha önce girilmiş marka / seri / model (katalogda olmayan yeni değerler dahil); her açılışta güncel. */
function loadGallery(): Promise<GalleryItem[]> {
  return fetch("/api/crm/katalog/galeri", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
}
/** Galerinin kendi girdiği değerleri kataloğa ekler (aynı ad büyük-küçük harf farkıyla tekrarlanmaz). */
function withGallery(catalog: VehicleCatalog, items: GalleryItem[]): VehicleCatalog {
  const out: VehicleCatalog = { ...catalog };
  for (const { brand, model, packageName } of items) {
    const b = findKey(out, brand) ?? brand;
    out[b] = { ...(out[b] ?? {}) };
    if (!model) continue;
    const m = findKey(out[b], model) ?? model;
    const entry = out[b][m] ?? { tur: null, motorlar: [] };
    out[b][m] = { ...entry, motorlar: packageName && !entry.motorlar.some((x) => key(x) === key(packageName)) ? [packageName, ...entry.motorlar] : entry.motorlar };
  }
  return out;
}

/** Türkiye ikinci el pazarında en çok satılan markalar: marka kutusu boşken önce bunlar görünür. */
const POPULAR_BRANDS = [
  "Renault", "Fiat", "Volkswagen", "Toyota", "Ford", "Hyundai", "Peugeot", "Opel", "Dacia", "Honda", "BMW", "Mercedes-Benz",
  "Audi", "Citroen", "Skoda", "Nissan", "Kia", "Seat", "Tofaş", "Chevrolet",
];
const key = (s: string) => s.trim().toLocaleLowerCase("tr");
const findKey = <T,>(obj: Record<string, T>, name: string) => Object.keys(obj).find((k) => key(k) === key(name));
const unique = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => !seen.has(key(x)) && seen.add(key(x)));
};
const sortTr = (list: string[]) => [...list].sort((a, b) => a.localeCompare(b, "tr"));

/** Marka / seri / motor önerileri: projedeki kısa liste + katalog (büyük-küçük harf duyarsız eşleşir). */
export function useVehicleCatalog() {
  const [catalog, setCatalog] = useState<VehicleCatalog>({});
  useEffect(() => {
    let alive = true;
    Promise.all([loadCatalog(), loadGallery()]).then(([c, g]) => alive && setCatalog(withGallery(c, g)));
    return () => {
      alive = false;
    };
  }, []);

  // Galerinin sık sattığı markalar listenin başında; gerisi alfabetik.
  const brands = () => unique([...POPULAR_BRANDS, ...sortTr([...Object.keys(BRAND_MODELS), ...Object.keys(catalog)])]);
  /** Seri adının geçtiği markalar (marka boşken seriden markayı bulmak için). */
  const brandsForSeries = (seri: string) =>
    seri.trim() ? Object.keys(catalog).filter((b) => findKey(catalog[b], seri)) : [];
  const series = (brand: string) => {
    // Marka boşsa bütün seriler önerilir; seri seçilince marka kendiliğinden dolar.
    if (!brand.trim()) return sortTr(unique(Object.values(catalog).flatMap((c) => Object.keys(c))));
    const own = BRAND_MODELS[findKey(BRAND_MODELS, brand) ?? ""] ?? [];
    const cat = catalog[findKey(catalog, brand) ?? ""] ?? {};
    return unique([...own, ...sortTr(Object.keys(cat))]);
  };
  /** Model önerileri: önce motorlar (1.0 TCe), sonra motor + paket birleşimleri (1.0 TCe Joy). */
  const motors = (brand: string, seri: string) => {
    // Marka boşsa ve seri tek bir markada geçiyorsa o markanın serisi kullanılır.
    const b = brand.trim() ? brand : brandsForSeries(seri).length === 1 ? brandsForSeries(seri)[0] : "";
    const cat = catalog[findKey(catalog, b) ?? ""] ?? {};
    const s = cat[findKey(cat, seri) ?? ""];
    if (!s) return [];
    const combos = s.motorlar.flatMap((m) => (s.paketler?.[m] ?? []).map((p) => `${m} ${p}`));
    return unique([...s.motorlar, ...combos]);
  };
  const knownBrand = (brand: string) => Boolean(findKey(BRAND_MODELS, brand) || findKey(catalog, brand));
  return { brands, series, motors, knownBrand, brandsForSeries };
}
