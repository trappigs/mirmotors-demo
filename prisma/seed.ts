// Demo verisini sıfırlar ve yeniden oluşturur. Tüm araçlar ve görseller temsilidir.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { carSvg } from "./placeholder-svg";

const prisma = new PrismaClient();
const STORAGE = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
export const DEMO_PASSWORD = "MirDemo2026!";

type SeedVehicle = {
  brand: string; model: string; packageName: string; year: number; km: number; price: number;
  fuel: string; transmission: string; bodyType: string; color: string; hex: string;
  enginePower: number; engineCc: number | null; drivetrain: string; equipment: string[];
  paintedParts: string; changedParts: string; damageNote: string; tramerAmount: number;
  expertiseSummary: string; description: string;
  status: "DRAFT" | "AVAILABLE" | "OPTIONED" | "SALE_PENDING" | "SOLD"; daysAgo: number;
};

const VEHICLES: SeedVehicle[] = [
  { brand: "BMW", model: "3 Serisi", packageName: "320i M Sport", year: 2022, km: 38500, price: 2_450_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Mineral Beyaz", hex: "#d9dbdd", enginePower: 170, engineCc: 1598, drivetrain: "Arkadan İtiş", equipment: ["Deri koltuk", "Navigasyon", "LED / Lazer far", "Geri görüş kamerası", "Apple CarPlay / Android Auto"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Motor, şanzıman ve yürüyen aksam testleri olumlu (temsili özet).", description: "Bakımları yetkili serviste yapılmış, temiz kullanılmış örnek araç.", status: "AVAILABLE", daysAgo: 2 },
  { brand: "Mercedes-Benz", model: "C Serisi", packageName: "C 200 AMG", year: 2023, km: 21000, price: 3_150_000, fuel: "Hibrit", transmission: "Otomatik", bodyType: "Sedan", color: "Obsidyen Siyahı", hex: "#1a1b1f", enginePower: 204, engineCc: 1496, drivetrain: "Arkadan İtiş", equipment: ["Panoramik cam tavan", "Ambiyans aydınlatma", "Head-up display", "360° kamera", "Hafızalı koltuk"], paintedParts: "Sağ arka çamurluk lokal boyalı", changedParts: "Yok", damageNote: "Küçük park sürtmesi, onarıldı.", tramerAmount: 8_400, expertiseSummary: "Lokal boya dışında orijinal (temsili özet).", description: "Hafif hibrit sistemli, zengin donanımlı örnek araç.", status: "AVAILABLE", daysAgo: 4 },
  { brand: "Audi", model: "Q5", packageName: "40 TDI quattro S line", year: 2021, km: 64000, price: 2_890_000, fuel: "Dizel", transmission: "Otomatik", bodyType: "SUV", color: "Navarra Mavisi", hex: "#2b3f66", enginePower: 204, engineCc: 1968, drivetrain: "4x4 / xDrive / quattro", equipment: ["Elektrikli bagaj kapağı", "Adaptif cruise control", "Şerit takip asistanı", "Isıtmalı koltuk"], paintedParts: "Yok", changedParts: "Ön tampon değişen", damageNote: "Ön tampon değişimi yapılmış.", tramerAmount: 15_200, expertiseSummary: "Değişen parça dışında kusur yok (temsili özet).", description: "quattro çekişli, uzun yol konforu yüksek örnek SUV.", status: "AVAILABLE", daysAgo: 6 },
  { brand: "Porsche", model: "Macan", packageName: "Macan T", year: 2022, km: 29800, price: 5_750_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Kireç Grisi", hex: "#8a8f94", enginePower: 265, engineCc: 1984, drivetrain: "4x4 / xDrive / quattro", equipment: ["Deri koltuk", "Panoramik cam tavan", "Kör nokta uyarısı", "Anahtarsız giriş"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Tüm testler olumlu (temsili özet).", description: "Sportif sürüş karakterli kompakt SUV, örnek ilan.", status: "OPTIONED", daysAgo: 8 },
  { brand: "Volvo", model: "XC60", packageName: "B5 Ultimate", year: 2023, km: 15500, price: 3_390_000, fuel: "Hibrit", transmission: "Otomatik", bodyType: "SUV", color: "Kristal Beyaz", hex: "#eceae4", enginePower: 250, engineCc: 1969, drivetrain: "4x4 / xDrive / quattro", equipment: ["Harman Kardon ses sistemi", "360° kamera", "Adaptif cruise control", "Isıtmalı koltuk"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Garanti kapsamında (temsili özet).", description: "Güvenlik donanımı zengin aile SUV'u, örnek ilan.", status: "AVAILABLE", daysAgo: 1 },
  { brand: "Volkswagen", model: "Golf", packageName: "1.5 eTSI R-Line", year: 2021, km: 52000, price: 1_390_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Hatchback", color: "Kings Kırmızısı", hex: "#9b1c22", enginePower: 150, engineCc: 1498, drivetrain: "Önden Çekiş", equipment: ["Apple CarPlay / Android Auto", "LED / Lazer far", "Park asistanı"], paintedParts: "Kaput boyalı", changedParts: "Yok", damageNote: "Taş izi nedeniyle kaput boyası.", tramerAmount: 3_100, expertiseSummary: "Kaput boyası dışında orijinal (temsili özet).", description: "Ekonomik ve keyifli şehir aracı, örnek ilan.", status: "AVAILABLE", daysAgo: 10 },
  { brand: "Tesla", model: "Model Y", packageName: "Long Range AWD", year: 2023, km: 26000, price: 2_350_000, fuel: "Elektrik", transmission: "Otomatik", bodyType: "SUV", color: "Derin Mavi", hex: "#24345a", enginePower: 514, engineCc: null, drivetrain: "4x4 / xDrive / quattro", equipment: ["Panoramik cam tavan", "Navigasyon", "Şerit takip asistanı", "Isıtmalı koltuk"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Batarya sağlığı raporu bekleniyor (temsili).", description: "Uzun menzilli elektrikli SUV, örnek ilan.", status: "AVAILABLE", daysAgo: 3 },
  { brand: "BMW", model: "X5", packageName: "xDrive40i M Sport", year: 2020, km: 78000, price: 4_250_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Karbon Siyahı", hex: "#15171c", enginePower: 340, engineCc: 2998, drivetrain: "4x4 / xDrive / quattro", equipment: ["Head-up display", "Harman Kardon ses sistemi", "Hafızalı koltuk", "360° kamera", "Panoramik cam tavan"], paintedParts: "Sol ön kapı boyalı", changedParts: "Yok", damageNote: "Kapıda çizik onarımı.", tramerAmount: 6_900, expertiseSummary: "Lokal boya dışında orijinal (temsili özet).", description: "Geniş ve güçlü lüks SUV, örnek ilan.", status: "AVAILABLE", daysAgo: 12 },
  { brand: "Range Rover", model: "Evoque", packageName: "P200 R-Dynamic SE", year: 2021, km: 41000, price: 3_050_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Seoul Pearl Silver", hex: "#a7a9ac", enginePower: 200, engineCc: 1997, drivetrain: "4x4 / xDrive / quattro", equipment: ["Deri koltuk", "Geri görüş kamerası", "Ambiyans aydınlatma"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Tüm testler olumlu (temsili özet).", description: "Şehir için şık kompakt SUV, örnek ilan.", status: "SALE_PENDING", daysAgo: 15 },
  { brand: "Audi", model: "A5", packageName: "Sportback 40 TFSI", year: 2020, km: 69000, price: 1_990_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Coupe", color: "Daytona Grisi", hex: "#4a4d52", enginePower: 190, engineCc: 1984, drivetrain: "Önden Çekiş", equipment: ["Navigasyon", "Isıtmalı koltuk", "Park asistanı"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Tüm testler olumlu (temsili özet).", description: "Örnek ilan — demoda satılmış olarak görünür.", status: "SOLD", daysAgo: 20 },
  { brand: "Mini", model: "Cooper", packageName: "S 3 Kapı", year: 2022, km: 18000, price: 1_550_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Hatchback", color: "Chili Kırmızı", hex: "#b3202a", enginePower: 178, engineCc: 1998, drivetrain: "Önden Çekiş", equipment: ["Apple CarPlay / Android Auto", "LED / Lazer far"], paintedParts: "", changedParts: "", damageNote: "", tramerAmount: 0, expertiseSummary: "", description: "Taslak örneği: fotoğraf ve ekspertiz bekleniyor.", status: "DRAFT", daysAgo: 0 },
];

async function main() {
  await rm(path.join(STORAGE, "public"), { recursive: true, force: true });
  await rm(path.join(STORAGE, "private"), { recursive: true, force: true });
  await prisma.statusHistory.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.vehiclePhoto.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();

  // Sabit kimlikler: `npm run db:reset` sonrasında tarayıcılardaki açık oturumlar geçerli kalır.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const admin = await prisma.user.create({ data: { id: "demo-yonetici", name: "Yönetici (Demo)", email: "yonetici@mirmotors.demo", passwordHash, role: "ADMIN" } });
  const ahmet = await prisma.user.create({ data: { id: "demo-ahmet", name: "Ahmet", email: "ahmet@mirmotors.demo", passwordHash, role: "SALES" } });
  const mehmet = await prisma.user.create({ data: { id: "demo-mehmet", name: "Mehmet", email: "mehmet@mirmotors.demo", passwordHash, role: "SALES" } });

  for (const v of VEHICLES) {
    const createdAt = new Date(Date.now() - v.daysAgo * 86_400_000);
    const { hex, status, daysAgo: _d, equipment, ...fields } = v;
    void _d;
    const vehicle = await prisma.vehicle.create({
      data: {
        ...fields,
        equipment: JSON.stringify(equipment),
        status,
        isDemoSeed: true,
        createdById: admin.id,
        createdAt,
        publishedAt: status === "DRAFT" ? null : createdAt,
        optionedById: status === "OPTIONED" || status === "SALE_PENDING" ? mehmet.id : null,
        optionedAt: status === "OPTIONED" || status === "SALE_PENDING" ? createdAt : null,
        soldAt: status === "SOLD" ? new Date() : null,
      },
    });

    if (status !== "DRAFT") {
      const dir = path.join(STORAGE, "public", "seed");
      await mkdir(dir, { recursive: true });
      for (let i = 0; i < 3; i++) {
        const name = `${vehicle.id}-${i}.svg`;
        await writeFile(path.join(dir, name), carSvg({ color: hex, bodyType: v.bodyType, title: `${v.brand} ${v.model}`, variant: i }));
        await prisma.vehiclePhoto.create({ data: { vehicleId: vehicle.id, path: `seed/${name}`, isCover: i === 0, sortOrder: i } });
      }
    }

    const h = (from: string | null, to: string, action: string, userId: string) =>
      prisma.statusHistory.create({ data: { vehicleId: vehicle.id, fromStatus: from, toStatus: to, action, userId, createdAt } });
    await h(null, "DRAFT", "create", admin.id);
    if (status !== "DRAFT") await h("DRAFT", "AVAILABLE", "publish", admin.id);
    if (["OPTIONED", "SALE_PENDING"].includes(status)) await h("AVAILABLE", "OPTIONED", "option", mehmet.id);
    if (status === "SALE_PENDING") {
      await h("OPTIONED", "SALE_PENDING", "startSale", mehmet.id);
      await prisma.sale.create({ data: { vehicleId: vehicle.id, startedById: mehmet.id, agreedPrice: v.price, note: "Örnek satış kaydı" } });
    }
    if (status === "SOLD") {
      await h("AVAILABLE", "OPTIONED", "option", ahmet.id);
      await h("OPTIONED", "SALE_PENDING", "startSale", ahmet.id);
      await h("SALE_PENDING", "SOLD", "completeSale", admin.id);
      await prisma.sale.create({
        data: { vehicleId: vehicle.id, startedById: ahmet.id, agreedPrice: v.price, notaryCompleted: true, notaryDate: new Date(), completedById: admin.id, completedAt: new Date(), note: "Örnek tamamlanmış satış" },
      });
    }
  }
  console.log(`Seed tamam: 3 kullanıcı, ${VEHICLES.length} araç. Demo şifresi: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
