// SİMÜLASYON MODU verisi: gerçek AI analizi DEĞİLDİR. API anahtarı olmadan akışı göstermek için sabit örnektir.
import type { VehicleDraft } from "./vehicle-draft";

export const SAMPLE_TRANSCRIPT = `Merhaba, bugün galerimize gelen 2021 model BMW 5 Serisi 520i M Sport'u tanıtıyoruz.
Araç 47 bin kilometrede, otomatik vites, benzinli. Rengi Phytonic mavi.
Motor 170 beygir, arkadan itiş. İçeride deri koltuklar, head-up display, Harman Kardon ses sistemi,
360 derece kamera ve hafızalı koltuklar var. Sağ ön çamurlukta lokal boya var, değişen parça yok.
Tramer kaydı 4.200 lira. Ekspertizde motor ve şanzıman testleri temiz çıktı.`;

export const SAMPLE_DRAFT: VehicleDraft = {
  brand: "BMW",
  model: "5 Serisi",
  packageName: "520i M Sport",
  year: 2021,
  km: 47000,
  price: null,
  fuel: "Benzin",
  transmission: "Otomatik",
  bodyType: null,
  color: "Phytonic Mavi",
  enginePower: 170,
  engineCc: null,
  drivetrain: "Arkadan İtiş",
  equipment: ["Deri koltuk", "Head-up display", "Harman Kardon ses sistemi", "360° kamera", "Hafızalı koltuk"],
  paintedParts: "Sağ ön çamurluk lokal boyalı",
  changedParts: "Yok",
  damageNote: null,
  tramerAmount: 4200,
  expertiseSummary: "Ekspertizde motor ve şanzıman testleri temiz.",
  description: "2021 model BMW 520i M Sport; 47.000 km, otomatik vites, zengin donanımlı.",
  evidence: [
    { field: "year", quote: "2021 model BMW 5 Serisi 520i M Sport" },
    { field: "km", quote: "47 bin kilometrede" },
    { field: "paintedParts", quote: "Sağ ön çamurlukta lokal boya var" },
    { field: "tramerAmount", quote: "Tramer kaydı 4.200 lira" },
  ],
  warnings: [
    "Fiyat dökümde geçmiyor; çalışan tarafından girilmeli.",
    "Kasa tipi dökümde açıkça söylenmedi; çalışan tarafından seçilmeli.",
  ],
};
