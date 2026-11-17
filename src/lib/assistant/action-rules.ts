import { formatPrice } from "../format";

/**
 * WhatsApp asistanının onaylı işlemleri için saf kurallar (veritabanına dokunmaz; testlenebilir).
 * Asıl yetki ve durum denetimi işlem anında CRM'in kendi kurallarıyla (transitionVehicle) yeniden yapılır;
 * buradaki ön kontrol yalnız personele baştan anlaşılır bir cevap vermek içindir.
 */

export const ASSISTANT_ACTIONS = ["option", "releaseOption", "startSale", "cancelSale", "completeSale", "setPrice"] as const;
export type AssistantActionName = (typeof ASSISTANT_ACTIONS)[number];

/** Onay bekleme süresi: bu süreden sonra "Onayla" işe yaramaz, işlem yeniden istenir. */
export const CONFIRM_TTL_MS = 10 * 60_000;
export const MAX_PRICE = 1_000_000_000;

type Actor = { id: string; role: string };
type VehicleState = { status: string; optionedById: string | null };

/** İşlemin bu araç ve personel için yapılıp yapılamayacağı. null = uygun; aksi hâlde Türkçe neden. */
export function precheck(action: AssistantActionName, v: VehicleState, actor: Actor, saleStarterId: string | null, price?: number | null): string | null {
  const admin = actor.role === "ADMIN";
  const ownOption = v.optionedById === actor.id;
  if (v.status === "SOLD") return "Bu araç satılmış; üzerinde işlem yapılamaz.";
  if (v.status === "ARCHIVED") return "Bu araç arşivde; önce yönetici CRM'den geri yüklemeli.";
  switch (action) {
    case "option":
      return v.status === "AVAILABLE" ? null : "Yalnız \"Satışta\" olan araç opsiyonlanabilir.";
    case "releaseOption":
      if (v.status !== "OPTIONED") return "Bu araç opsiyonlu değil.";
      return admin || ownOption ? null : "Opsiyonu yalnız opsiyonlayan personel ya da yönetici kaldırabilir.";
    case "startSale":
      if (v.status === "AVAILABLE") return validPrice(price, true);
      if (v.status === "OPTIONED") return admin || ownOption ? validPrice(price, true) : "Bu araç başka bir personel adına opsiyonlu.";
      if (v.status === "SALE_PENDING") return "Bu aracın satış süreci zaten başlamış.";
      return "Satış yalnız \"Satışta\" ya da \"Opsiyonlu\" araçta başlatılabilir.";
    case "cancelSale":
      if (v.status !== "SALE_PENDING") return "Bu araçta devam eden bir satış yok.";
      return admin ? null : "Satış iptali yalnız yönetici yetkisindedir.";
    case "completeSale":
      if (v.status !== "SALE_PENDING") return "Satışı tamamlamak için önce satış başlatılmalı.";
      return admin || saleStarterId === actor.id ? null : "Satışı yalnız satışı başlatan personel ya da yönetici tamamlayabilir.";
    case "setPrice": {
      const bad = validPrice(price, false);
      if (bad) return bad;
      if (["REVIEW", "DRAFT", "AVAILABLE"].includes(v.status)) return null;
      if (v.status === "OPTIONED") return admin || ownOption ? null : "Opsiyonlu aracın fiyatını yalnız opsiyonlayan personel ya da yönetici değiştirebilir.";
      return "Satış sürecindeki aracın fiyatı değiştirilemez.";
    }
  }
}

function validPrice(price: number | null | undefined, optional: boolean): string | null {
  if (price == null) return optional ? null : "Yeni fiyat belirtilmeli.";
  if (!Number.isInteger(price) || price <= 0 || price > MAX_PRICE) return "Fiyat geçersiz.";
  return null;
}

/** Personelin onaylayacağı özet. Onaylanan metin budur; yapay zekânın serbest metni değil. */
export function describeAction(action: AssistantActionName, vehicle: string, oldPrice: number | null, price?: number | null): string {
  switch (action) {
    case "option":
      return `${vehicle}\n→ Aracı kendi adınıza *opsiyonla*.`;
    case "releaseOption":
      return `${vehicle}\n→ *Opsiyonu kaldır*, araç tekrar "Satışta" olsun.`;
    case "startSale":
      return `${vehicle}\n→ *Satış başlat*${price ? ` (anlaşılan fiyat ${formatPrice(price)})` : ""}. Araç sitede gizlenir.`;
    case "cancelSale":
      return `${vehicle}\n→ *Satışı iptal et*, araç tekrar "Satışta" olsun.`;
    case "completeSale":
      return `${vehicle}\n→ *Satışı tamamla*. Noter devrinin tamamlandığını onaylıyorsunuz; araç "Satıldı" olur.`;
    case "setPrice":
      return `${vehicle}\n→ *Fiyatı değiştir*: ${formatPrice(oldPrice)} → ${formatPrice(price)}.`;
  }
}

/** Düğme kimliği: "ok:<id>" onay, "no:<id>" vazgeç. */
export function parseButtonId(id: string | null | undefined): { confirm: boolean; actionId: string } | null {
  const m = /^(ok|no):([a-z0-9]{10,40})$/i.exec(id ?? "");
  return m ? { confirm: m[1].toLowerCase() === "ok", actionId: m[2] } : null;
}

const norm = (t: string) => t.trim().toLocaleLowerCase("tr-TR").replace(/[.!?,\s]+$/g, "").replace(/^[\s]+/, "");

/** Kısa yazılı onay ("evet", "onayla", "tamam"). Uzun cümleler onay sayılmaz; yapay zekâya gider. */
export function isTypedConfirm(text: string | null | undefined): boolean {
  return !!text && /^(evet|onay|onayla|onaylıyorum|onayliyorum|tamam|ok|olur|yap)$/.test(norm(text));
}

export function isTypedCancel(text: string | null | undefined): boolean {
  return !!text && /^(hayır|hayir|vazgeç|vazgec|iptal|yapma|dur)$/.test(norm(text));
}

/** WhatsApp'tan araç ekleme: yalnız temel ilan bilgileri; araç TASLAK açılır, kalan bilgiler CRM'de tamamlanır. */
export type NewVehicle = {
  brand: string; model: string; packageName?: string | null; year?: number | null; km?: number | null; price?: number | null;
  fuel?: string | null; transmission?: string | null; bodyType?: string | null; color?: string | null; legalPlate?: string | null;
};

const fmtInt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

/** Personelin onaylayacağı yeni araç özeti (yalnız verilen bilgiler; boşlar "girilmedi" diye listelenir). */
export function describeNewVehicle(v: NewVehicle): string {
  const missing = [
    v.year == null && "yıl", v.km == null && "km", v.price == null && "fiyat", !v.fuel && "yakıt", !v.transmission && "vites", !v.legalPlate && "plaka",
  ].filter(Boolean);
  return [
    `*Yeni araç (taslak)*: ${[v.brand, v.model, v.packageName].filter(Boolean).join(" ")}`,
    [v.year, v.km != null ? `${fmtInt(v.km)} km` : null, v.price != null ? formatPrice(v.price) : null, v.fuel, v.transmission, v.bodyType, v.color, v.legalPlate ? `plaka ${v.legalPlate}` : null]
      .filter(Boolean).join(" · "),
    missing.length ? `Girilmedi: ${missing.join(", ")} (CRM'de tamamlanır)` : null,
    `Araç sitede görünmez; yayın CRM'den yapılır.`,
  ].filter(Boolean).join("\n");
}

/** Fotoğraf açıklamasındaki araç numarası: "#abc123" (ilk geçen). */
export function captionRef(caption: string | null | undefined): string | null {
  const m = /#([a-z0-9]{4,30})/i.exec(caption ?? "");
  return m ? m[1] : null;
}

/** WhatsApp'tan açılan taslağa açıklamasız fotoğrafların eklenebileceği süre. */
export const PHOTO_WINDOW_MS = 60 * 60_000;
