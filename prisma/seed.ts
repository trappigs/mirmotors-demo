// Demo verisini sıfırlar ve yeniden oluşturur. Tüm araçlar temsilidir.
// Fotoğraflar public/demo-cars/ altındadır (Unsplash License, bkz. public/demo-cars/CREDITS.md);
// araç bilgileri (yıl, paket, renk) fotoğraftaki modelle uyumlu olacak şekilde seçilmiştir.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { copyFile, mkdir, rm } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();
const STORAGE = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
const DEMO_CARS = path.join(process.cwd(), "public", "demo-cars");
export const DEMO_PASSWORD = "MirDemo2026!";

type SeedVehicle = {
  brand: string; model: string; packageName: string; year: number; km: number; price: number;
  fuel: string; transmission: string; bodyType: string; color: string; photos: string[];
  enginePower: number; engineCc: number | null; drivetrain: string; equipment: string[];
  paintedParts: string; changedParts: string; damageNote: string; tramerAmount: number;
  expertiseSummary: string; description: string;
  status: "DRAFT" | "AVAILABLE" | "OPTIONED" | "SALE_PENDING" | "SOLD"; daysAgo: number;
};

const VEHICLES: SeedVehicle[] = [
  { brand: "BMW", model: "3 Serisi", packageName: "320i M Sport", year: 2022, km: 38500, price: 2_450_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Antrasit Gri", photos: ["bmw-3-serisi-1.jpg"], enginePower: 170, engineCc: 1598, drivetrain: "Arkadan İtiş", equipment: ["Deri koltuk", "Navigasyon", "LED / Lazer far", "Geri görüş kamerası", "Apple CarPlay / Android Auto"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Motor, şanzıman ve yürüyen aksam testleri olumlu (temsili özet).", description: "Bakımları yetkili serviste yapılmış, temiz kullanılmış örnek araç.", status: "AVAILABLE", daysAgo: 2 },
  { brand: "Mercedes-Benz", model: "C Serisi", packageName: "C 200 AMG", year: 2020, km: 46000, price: 2_390_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Iridyum Gümüş", photos: ["mercedes-c-serisi-1.jpg"], enginePower: 184, engineCc: 1496, drivetrain: "Arkadan İtiş", equipment: ["Panoramik cam tavan", "Ambiyans aydınlatma", "Head-up display", "360° kamera", "Hafızalı koltuk"], paintedParts: "Sağ arka çamurluk lokal boyalı", changedParts: "Yok", damageNote: "Küçük park sürtmesi, onarıldı.", tramerAmount: 8_400, expertiseSummary: "Lokal boya dışında orijinal (temsili özet).", description: "Zengin donanımlı, bakımlı örnek araç.", status: "AVAILABLE", daysAgo: 4 },
  { brand: "Audi", model: "Q5", packageName: "40 TDI quattro S line", year: 2021, km: 64000, price: 2_890_000, fuel: "Dizel", transmission: "Otomatik", bodyType: "SUV", color: "Manhattan Gri", photos: ["audi-q5-1.jpg"], enginePower: 204, engineCc: 1968, drivetrain: "4x4 / xDrive / quattro", equipment: ["Elektrikli bagaj kapağı", "Adaptif cruise control", "Şerit takip asistanı", "Isıtmalı koltuk"], paintedParts: "Yok", changedParts: "Ön tampon değişen", damageNote: "Ön tampon değişimi yapılmış.", tramerAmount: 15_200, expertiseSummary: "Değişen parça dışında kusur yok (temsili özet).", description: "quattro çekişli, uzun yol konforu yüksek örnek SUV.", status: "AVAILABLE", daysAgo: 6 },
  { brand: "Porsche", model: "Macan", packageName: "T", year: 2022, km: 29800, price: 5_750_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Siyah", photos: ["porsche-macan-1.jpg"], enginePower: 265, engineCc: 1984, drivetrain: "4x4 / xDrive / quattro", equipment: ["Deri koltuk", "Panoramik cam tavan", "Kör nokta uyarısı", "Anahtarsız giriş"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Tüm testler olumlu (temsili özet).", description: "Sportif sürüş karakterli kompakt SUV, örnek ilan.", status: "OPTIONED", daysAgo: 8 },
  { brand: "Volvo", model: "XC60", packageName: "B5 AWD R-Design", year: 2021, km: 35500, price: 2_890_000, fuel: "Hibrit", transmission: "Otomatik", bodyType: "SUV", color: "Bursting Blue (Mavi)", photos: ["volvo-xc60-1.jpg", "volvo-xc60-2.jpg", "volvo-xc60-3.jpg"], enginePower: 250, engineCc: 1969, drivetrain: "4x4 / xDrive / quattro", equipment: ["Harman Kardon ses sistemi", "360° kamera", "Adaptif cruise control", "Isıtmalı koltuk"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Tüm testler olumlu (temsili özet).", description: "Güvenlik donanımı zengin aile SUV'u, örnek ilan.", status: "AVAILABLE", daysAgo: 1 },
  { brand: "Volkswagen", model: "Golf", packageName: "2.0 TSI GTI", year: 2021, km: 52000, price: 1_890_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Hatchback", color: "Kings Kırmızısı", photos: ["vw-golf-1.jpg"], enginePower: 245, engineCc: 1984, drivetrain: "Önden Çekiş", equipment: ["Apple CarPlay / Android Auto", "LED / Lazer far", "Park asistanı"], paintedParts: "Kaput boyalı", changedParts: "Yok", damageNote: "Taş izi nedeniyle kaput boyası.", tramerAmount: 3_100, expertiseSummary: "Kaput boyası dışında orijinal (temsili özet).", description: "Performans odaklı, keyifli hatchback, örnek ilan.", status: "AVAILABLE", daysAgo: 10 },
  { brand: "Tesla", model: "Model Y", packageName: "Long Range AWD", year: 2023, km: 26000, price: 2_350_000, fuel: "Elektrik", transmission: "Otomatik", bodyType: "SUV", color: "Gece Gümüşü", photos: ["tesla-model-y-1.jpg", "tesla-model-y-2.jpg"], enginePower: 514, engineCc: null, drivetrain: "4x4 / xDrive / quattro", equipment: ["Panoramik cam tavan", "Navigasyon", "Şerit takip asistanı", "Isıtmalı koltuk"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Batarya sağlığı raporu bekleniyor (temsili).", description: "Uzun menzilli elektrikli SUV, örnek ilan.", status: "AVAILABLE", daysAgo: 3 },
  { brand: "BMW", model: "X5", packageName: "xDrive40i M Sport", year: 2020, km: 78000, price: 4_250_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Antrasit", photos: ["bmw-x5-1.jpg"], enginePower: 340, engineCc: 2998, drivetrain: "4x4 / xDrive / quattro", equipment: ["Head-up display", "Harman Kardon ses sistemi", "Hafızalı koltuk", "360° kamera", "Panoramik cam tavan"], paintedParts: "Sol ön kapı boyalı", changedParts: "Yok", damageNote: "Kapıda çizik onarımı.", tramerAmount: 6_900, expertiseSummary: "Lokal boya dışında orijinal (temsili özet).", description: "Geniş ve güçlü lüks SUV, örnek ilan.", status: "AVAILABLE", daysAgo: 12 },
  { brand: "Range Rover", model: "Evoque", packageName: "2.0 Si4 HSE Dynamic", year: 2018, km: 61000, price: 2_250_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "SUV", color: "Firenze Kırmızısı", photos: ["range-rover-evoque-1.jpg"], enginePower: 240, engineCc: 1997, drivetrain: "4x4 / xDrive / quattro", equipment: ["Deri koltuk", "Geri görüş kamerası", "Ambiyans aydınlatma"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Tüm testler olumlu (temsili özet).", description: "Şehir için şık kompakt SUV, örnek ilan.", status: "SALE_PENDING", daysAgo: 15 },
  { brand: "Audi", model: "A5", packageName: "Sportback 40 TFSI", year: 2020, km: 69000, price: 1_990_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Coupe", color: "İbis Beyazı", photos: ["audi-a5-1.jpg", "audi-a5-2.jpg", "audi-a5-3.jpg"], enginePower: 190, engineCc: 1984, drivetrain: "Önden Çekiş", equipment: ["Navigasyon", "Isıtmalı koltuk", "Park asistanı"], paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasar kaydı yok.", tramerAmount: 0, expertiseSummary: "Tüm testler olumlu (temsili özet).", description: "Örnek ilan — demoda satılmış olarak görünür.", status: "SOLD", daysAgo: 20 },
  { brand: "Mini", model: "Cooper", packageName: "S 3 Kapı", year: 2022, km: 18000, price: 1_550_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Hatchback", color: "Chili Kırmızı", photos: [], enginePower: 178, engineCc: 1998, drivetrain: "Önden Çekiş", equipment: ["Apple CarPlay / Android Auto", "LED / Lazer far"], paintedParts: "", changedParts: "", damageNote: "", tramerAmount: 0, expertiseSummary: "", description: "Taslak örneği: fotoğraf ve ekspertiz bekleniyor.", status: "DRAFT", daysAgo: 0 },
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
    const { photos, status, daysAgo: _d, equipment, ...fields } = v;
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

    // Demo fotoğrafları storage'a kopyalanır; böylece CRM'den silme/kapak seçme normal fotoğraflar gibi çalışır.
    const dir = path.join(STORAGE, "public", "seed");
    await mkdir(dir, { recursive: true });
    for (const [i, file] of photos.entries()) {
      const name = `${vehicle.id}-${i}${path.extname(file)}`;
      await copyFile(path.join(DEMO_CARS, file), path.join(dir, name));
      await prisma.vehiclePhoto.create({ data: { vehicleId: vehicle.id, path: `seed/${name}`, isCover: i === 0, sortOrder: i } });
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
