// REVIEW: belgeden AI ile oluşturuldu, personel kontrolü bekliyor (müşteriye görünmez).
// ARCHIVED: yanlış / mükerrer / artık satılmayacak kayıt; silinmez, müşteriye görünmez, yalnızca yönetici geri yükler.
export const VEHICLE_STATUSES = ["REVIEW", "DRAFT", "AVAILABLE", "OPTIONED", "SALE_PENDING", "SOLD", "ARCHIVED"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

/** Müşteri sitesinde görünen durumlar. Diğerleri ön yüzden tamamen gizlenir. */
export const PUBLIC_STATUSES: VehicleStatus[] = ["AVAILABLE", "OPTIONED"];

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  REVIEW: "Kontrol Bekliyor",
  DRAFT: "Taslak",
  AVAILABLE: "Satışta",
  OPTIONED: "Opsiyonlu",
  SALE_PENDING: "Satış Bekliyor",
  SOLD: "Satıldı",
  ARCHIVED: "Arşivlendi",
};

export const STATUS_COLORS: Record<VehicleStatus, string> = {
  REVIEW: "bg-violet-100 text-violet-800",
  DRAFT: "bg-zinc-200 text-zinc-700",
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  OPTIONED: "bg-amber-100 text-amber-800",
  SALE_PENDING: "bg-sky-100 text-sky-800",
  SOLD: "bg-zinc-800 text-white",
  ARCHIVED: "bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-300",
};

export const ROLES = ["ADMIN", "SALES"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { ADMIN: "Yönetici", SALES: "Satış Personeli" };

export const FUEL_TYPES = ["Benzin", "Dizel", "Hibrit", "Elektrik", "LPG"];
export const TRANSMISSIONS = ["Otomatik", "Yarı Otomatik", "Manuel"];
// Ticari araçlar (Panelvan, Kamyonet, Minibüs) listenin sonunda: mevcut kayıtların değerleri değişmez.
export const BODY_TYPES = ["Sedan", "Hatchback", "SUV", "Coupe", "Cabrio", "Station Wagon", "MPV", "Pick-up", "Panelvan", "Kamyonet", "Minibüs"];
export const DRIVETRAINS = ["Önden Çekiş", "Arkadan İtiş", "4x4 / xDrive / quattro"];
/** Renk listesi: sitedeki renk filtresi tek tip kalsın diye seçimle girilir (listede olmayan eski değerler korunur). */
export const COLORS = ["Beyaz", "Siyah", "Gri", "Gümüş Gri", "Füme", "Lacivert", "Mavi", "Kırmızı", "Bordo", "Kahverengi", "Bej", "Şampanya", "Yeşil", "Sarı", "Turuncu", "Mor"];
const COLOR_ALIASES: Record<string, string> = { "gümüş": "Gümüş Gri", "kahve": "Kahverengi" };

/** Ruhsattaki büyük harfli rengi ("BEYAZ") listedeki adla eşler; eşleşmezse yalnızca harf düzenini düzeltir ("METALİK GRİ" → "Metalik Gri"). */
export function normalizeColor(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const low = t.toLocaleLowerCase("tr");
  const hit = COLORS.find((c) => c.toLocaleLowerCase("tr") === low) ?? COLOR_ALIASES[low];
  if (hit) return hit;
  return low.split(" ").map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1)).join(" ");
}

/**
 * Marka → model önerileri (Türkiye'de yaygın binek ve hafif ticari araçlar). Yalnızca öneridir: listede olmayan marka/model elle yazılır.
 * Motor/paket kataloğu yoktur; motor bilgisi ruhsattan (P.1, P.2) veya elle girilir. "Range Rover" eski kayıtlar için korunur.
 */
export const BRAND_MODELS: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Giulietta", "Stelvio", "Tonale"],
  Audi: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron", "e-tron GT"],
  BMW: ["1 Serisi", "2 Serisi", "3 Serisi", "4 Serisi", "5 Serisi", "7 Serisi", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "iX", "iX1", "i4", "M3", "M4"],
  Chery: ["Omoda 5", "Tiggo 7 Pro", "Tiggo 8 Pro"],
  Citroen: ["C3", "C3 Aircross", "C4", "C5 Aircross", "C-Elysee", "Berlingo", "Nemo", "Jumpy", "Jumper"],
  Dacia: ["Sandero", "Logan", "Duster", "Jogger", "Lodgy", "Dokker"],
  Fiat: ["Egea", "Linea", "Punto", "Palio", "Albea", "500", "Doblo", "Fiorino", "Scudo", "Ducato"],
  Ford: ["Fiesta", "Focus", "Mondeo", "Puma", "Kuga", "Ranger", "Tourneo Courier", "Tourneo Connect", "Transit Courier", "Transit Connect", "Transit Custom", "Transit"],
  Honda: ["Jazz", "City", "Civic", "HR-V", "CR-V"],
  Hyundai: ["i10", "i20", "i30", "Accent", "Elantra", "Bayon", "Kona", "Tucson", "Santa Fe", "H-1", "H350"],
  Isuzu: ["D-Max", "NPR"],
  Iveco: ["Daily"],
  Kia: ["Picanto", "Rio", "Ceed", "Stonic", "Niro", "Sportage", "Sorento"],
  "Land Rover": ["Defender", "Discovery", "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque"],
  "Mercedes-Benz": ["A Serisi", "B Serisi", "C Serisi", "E Serisi", "S Serisi", "CLA", "GLA", "GLC", "GLE", "G Serisi", "AMG GT", "Citan", "Vito", "Viano", "Sprinter"],
  Mini: ["Cooper", "Countryman"],
  Nissan: ["Micra", "Juke", "Qashqai", "X-Trail", "Navara", "NV200"],
  Opel: ["Corsa", "Astra", "Insignia", "Mokka", "Crossland", "Grandland", "Combo", "Vivaro", "Movano"],
  Peugeot: ["208", "2008", "301", "308", "3008", "408", "508", "5008", "Bipper", "Partner", "Rifter", "Expert", "Boxer"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera", "Taycan"],
  "Range Rover": ["Evoque", "Velar", "Sport", "Vogue"],
  Renault: ["Clio", "Clio Symbol", "Symbol", "Megane", "Fluence", "Taliant", "Captur", "Kadjar", "Austral", "Koleos", "Kangoo", "Trafic", "Master"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca"],
  Skoda: ["Fabia", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq"],
  Suzuki: ["Swift", "Vitara", "S-Cross"],
  Tesla: ["Model 3", "Model Y", "Model S"],
  Togg: ["T10X"],
  Toyota: ["Yaris", "Corolla", "C-HR", "RAV4", "Hilux", "Proace City", "Proace"],
  Volkswagen: ["Polo", "Golf", "Jetta", "Passat", "T-Roc", "T-Cross", "Tiguan", "Touareg", "Amarok", "Caddy", "Transporter", "Caravelle", "Crafter", "LT"],
  Volvo: ["S60", "S90", "XC40", "XC60", "XC90"],
};

/**
 * Donanım seçenekleri: basılı "Araç Kontrol ve İlan Bilgi Formu" (belgeler/arac-kontrol-formu.html) ile aynı gruplar ve adlar.
 * Mevcut kayıtlardaki eski adlar (ör. "Harman Kardon ses sistemi") silinmez; CRM formunda ek seçenek olarak görünür.
 */
export const EQUIPMENT_GROUPS: Record<string, string[]> = {
  "Güvenlik": [
    "ABS", "ESP", "Sürücü / yolcu hava yastığı", "Yan / perde hava yastığı", "Isofix", "Lastik basınç sensörü",
    "Şerit takip asistanı", "Kör nokta uyarısı", "Adaptif cruise control", "Acil fren asistanı", "Yorgunluk uyarısı", "Yokuş kalkış desteği",
  ],
  "Konfor": [
    "Klima", "Otomatik klima", "Elektrikli camlar", "Elektrikli aynalar", "Hız sabitleyici", "Anahtarsız giriş",
    "Start-stop", "Yağmur / far sensörü", "Deri koltuk", "Isıtmalı koltuk", "Hafızalı koltuk", "Elektrikli bagaj kapağı",
  ],
  "Multimedya": [
    "Bluetooth", "USB", "Apple CarPlay / Android Auto", "Navigasyon", "Dokunmatik ekran", "Dijital gösterge",
    "Head-up display", "Premium ses sistemi", "Kablosuz şarj", "Ambiyans aydınlatma",
  ],
  "Dış donanım ve park": [
    "Sunroof", "Panoramik cam tavan", "LED / Lazer far", "Sis farı", "Alaşım jant", "Park sensörü",
    "Geri görüş kamerası", "360° kamera", "Park asistanı", "Tavan rayı", "Çeki demiri", "Karartılmış cam",
  ],
};
export const EQUIPMENT_OPTIONS = Object.values(EQUIPMENT_GROUPS).flat();

export const UPLOAD_LIMITS = {
  photo: { maxBytes: 10 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"], exts: [".jpg", ".jpeg", ".png", ".webp"] },
  // Vercel'de (Blob ücretsiz kotası) videolar 50 MB ile sınırlıdır; yerelde 200 MB.
  video: { maxBytes: (process.env.BLOB_READ_WRITE_TOKEN ? 50 : 200) * 1024 * 1024, mimes: ["video/mp4", "video/webm", "video/quicktime"], exts: [".mp4", ".webm", ".mov"] },
  pdf: { maxBytes: 15 * 1024 * 1024, mimes: ["application/pdf"], exts: [".pdf"] },
  // Ruhsat / ekspertiz raporu fotoğrafı: yalnızca CRM'de (özel depolama), müşteriye hiç açılmaz.
  doc: { maxBytes: 15 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"], exts: [".jpg", ".jpeg", ".png", ".webp"] },
} as const;

export const MIN_PHOTOS_TO_PUBLISH = 1;
