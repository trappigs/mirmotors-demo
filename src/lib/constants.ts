export const VEHICLE_STATUSES = ["DRAFT", "AVAILABLE", "OPTIONED", "SALE_PENDING", "SOLD"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

/** Müşteri sitesinde görünen durumlar. Diğerleri ön yüzden tamamen gizlenir. */
export const PUBLIC_STATUSES: VehicleStatus[] = ["AVAILABLE", "OPTIONED"];

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  DRAFT: "Taslak",
  AVAILABLE: "Satışta",
  OPTIONED: "Opsiyonlu",
  SALE_PENDING: "Satış Bekliyor",
  SOLD: "Satıldı",
};

export const STATUS_COLORS: Record<VehicleStatus, string> = {
  DRAFT: "bg-zinc-200 text-zinc-700",
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  OPTIONED: "bg-amber-100 text-amber-800",
  SALE_PENDING: "bg-sky-100 text-sky-800",
  SOLD: "bg-zinc-800 text-white",
};

export const ROLES = ["ADMIN", "SALES"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { ADMIN: "Yönetici", SALES: "Satış Personeli" };

export const FUEL_TYPES = ["Benzin", "Dizel", "Hibrit", "Elektrik", "LPG"];
export const TRANSMISSIONS = ["Otomatik", "Yarı Otomatik", "Manuel"];
export const BODY_TYPES = ["Sedan", "Hatchback", "SUV", "Coupe", "Cabrio", "Station Wagon", "MPV", "Pick-up"];
export const DRIVETRAINS = ["Önden Çekiş", "Arkadan İtiş", "4x4 / xDrive / quattro"];

export const BRAND_MODELS: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Stelvio", "Tonale"],
  Audi: ["A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "Q8", "e-tron GT"],
  BMW: ["1 Serisi", "2 Serisi", "3 Serisi", "4 Serisi", "5 Serisi", "7 Serisi", "X1", "X3", "X5", "X6", "iX", "i4", "M3", "M4"],
  "Mercedes-Benz": ["A Serisi", "C Serisi", "E Serisi", "S Serisi", "CLA", "GLA", "GLC", "GLE", "G Serisi", "AMG GT"],
  Mini: ["Cooper", "Countryman"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera", "Taycan"],
  "Range Rover": ["Evoque", "Velar", "Sport", "Vogue"],
  Tesla: ["Model 3", "Model Y", "Model S"],
  Toyota: ["Corolla", "C-HR", "RAV4"],
  Volkswagen: ["Golf", "Passat", "Tiguan", "Touareg"],
  Volvo: ["S60", "S90", "XC40", "XC60", "XC90"],
};

export const EQUIPMENT_OPTIONS = [
  "Panoramik cam tavan",
  "Deri koltuk",
  "Isıtmalı koltuk",
  "Hafızalı koltuk",
  "Adaptif cruise control",
  "Şerit takip asistanı",
  "Kör nokta uyarısı",
  "360° kamera",
  "Geri görüş kamerası",
  "Head-up display",
  "Harman Kardon ses sistemi",
  "Apple CarPlay / Android Auto",
  "Navigasyon",
  "LED / Lazer far",
  "Elektrikli bagaj kapağı",
  "Anahtarsız giriş",
  "Park asistanı",
  "Ambiyans aydınlatma",
];

export const UPLOAD_LIMITS = {
  photo: { maxBytes: 10 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"], exts: [".jpg", ".jpeg", ".png", ".webp"] },
  video: { maxBytes: 200 * 1024 * 1024, mimes: ["video/mp4", "video/webm", "video/quicktime"], exts: [".mp4", ".webm", ".mov"] },
  pdf: { maxBytes: 15 * 1024 * 1024, mimes: ["application/pdf"], exts: [".pdf"] },
} as const;

export const MIN_PHOTOS_TO_PUBLISH = 1;
