import "server-only";
import { mediaUrl } from "./format";
import type { PublicVehicleListItem } from "./public-vehicles";

export type StorySlide = { image: string; title: string; subtitle?: string; href?: string; hrefLabel?: string };
export type Story = { id: string; label: string; cover: string; slides: StorySlide[] };

/**
 * Ana sayfa story şeridi. Yalnızca yerel demo verisinden (yayındaki araçlar + izinli showroom fotoğrafı) üretilir;
 * Instagram API kullanılmaz, teslimat/yorum/kampanya gibi olmayan içerik gösterilmez.
 */
export function buildStories(vehicles: PublicVehicleListItem[]): Story[] {
  const withPhoto = vehicles.filter((v) => v.photos[0]);
  const slide = (v: PublicVehicleListItem): StorySlide => ({
    image: mediaUrl(v.photos[0].path)!,
    title: `${v.year} ${v.brand} ${v.model} ${v.packageName ?? ""}`.trim(),
    subtitle: v.status === "OPTIONED" ? "Opsiyonlu" : undefined,
    href: `/araclar/${v.id}`,
    hrefLabel: "Aracı İncele",
  });
  const byDate = [...withPhoto].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const byPrice = [...withPhoto].sort((a, b) => b.price - a.price);

  const stories = [
    { id: "yeni", label: "Yeni Gelenler", slides: byDate.slice(0, 4).map(slide) },
    { id: "stok", label: "Stoktakiler", slides: withPhoto.slice(0, 8).map(slide) },
    { id: "suv", label: "SUV Modeller", slides: withPhoto.filter((v) => v.bodyType === "SUV").slice(0, 6).map(slide) },
    { id: "sedan", label: "Sedan Modeller", slides: withPhoto.filter((v) => v.bodyType === "Sedan").slice(0, 6).map(slide) },
    // "Öne çıkanlar": stoktaki en üst fiyat segmentindeki araçlar (ayrı bir kampanya/öne çıkarma verisi yoktur)
    { id: "one-cikan", label: "Öne Çıkanlar", slides: byPrice.slice(0, 4).map((v) => ({ ...slide(v), subtitle: slide(v).subtitle ?? "Üst segment" })) },
    {
      id: "showroom",
      label: "Showroom",
      slides: [{ image: "/demo-cars/hero-showroom.jpg", title: "Showroom", subtitle: "Temsili görsel", href: "/iletisim", hrefLabel: "Ziyaret Planla" }],
    },
  ].filter((s) => s.slides.length > 0) as Omit<Story, "cover">[];

  // Kapaklar: mümkünse her story'de önceki story'lerde kullanılmamış bir fotoğraf (şerit tekrarlı görünmesin).
  const used = new Set<string>();
  return stories.map((s) => {
    const first = s.slides.find((sl) => !used.has(sl.image)) ?? s.slides[0];
    used.add(first.image);
    // Görüntüleyici, daire kapağındaki fotoğrafla açılsın
    return { ...s, cover: first.image, slides: [first, ...s.slides.filter((sl) => sl !== first)] };
  });
}
