// Demo senaryosunun (14 adım) çalışan sunucuya karşı HTTP üzerinden uçtan uca testi.
// Kullanım: önce `npm run db:reset` ve sunucuyu başlatın, sonra: node tests/e2e-demo.mjs [http://localhost:3000]
import { readFile } from "fs/promises";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = "MirDemo2026!";
let failures = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && extra ? `  →  ${extra}` : ""}`);
  if (!cond) failures++;
}

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  return { ok: res.ok, cookie };
}

function client(cookie) {
  return async (path, init = {}) => {
    const headers = { ...(init.headers || {}), cookie };
    let body = init.body;
    if (init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers, body, redirect: "manual" });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
}

async function fileForm(field, path, name, type) {
  const fd = new FormData();
  fd.append(field, new Blob([await readFile(path)], { type }), name);
  return fd;
}

const publicHtml = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, html: await res.text(), headers: res.headers };
};

// --- Güvenlik ---
{
  const r = await fetch(`${BASE}/api/crm/vehicles`, { method: "POST", body: "{}" });
  check("Oturumsuz CRM API isteği reddedilir (401)", r.status === 401, r.status);
  const p = await fetch(`${BASE}/crm`, { redirect: "manual" });
  check("Oturumsuz CRM sayfası girişe yönlendirir", p.status === 307 && p.headers.get("location")?.includes("/crm/login"), p.status);
  const bad = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "ahmet@mirmotors.demo", password: "yanlis" }) });
  check("Yanlış şifre reddedilir", bad.status === 401);
  const home = await publicHtml("/");
  check("Site noindex başlığı taşır", (home.headers.get("x-robots-tag") || "").includes("noindex"));
  check("Sitede DEMO ibaresi var", home.html.includes("DEMO"));
}

// 1. Giriş
const admin = await login("yonetici@mirmotors.demo");
const ahmet = await login("ahmet@mirmotors.demo");
const mehmet = await login("mehmet@mirmotors.demo");
check("1. Personel girişi (yönetici, Ahmet, Mehmet)", admin.ok && ahmet.ok && mehmet.ok);
const A = client(ahmet.cookie), M = client(mehmet.cookie), Y = client(admin.cookie);

// 2. Yeni BMW
const create = await A("/api/crm/vehicles", {
  method: "POST",
  json: {
    brand: "BMW", model: "5 Serisi", packageName: "520i M Sport E2E", year: 2023, km: 12000, price: 3_675_000,
    fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Siyah", equipment: ["Deri koltuk", "Head-up display"],
    paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasarsız", tramerAmount: 0, expertiseSummary: "Temiz (test)",
  },
});
check("2. Yeni BMW taslak olarak oluşturuldu", create.status === 201 && create.data.id, JSON.stringify(create.data));
const id = create.data.id;

// Fotoğrafsız yayımlama engeli
const pubNoPhoto = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "publish" } });
check("Fotoğraf olmadan yayımlanamaz (422)", pubNoPhoto.status === 422, JSON.stringify(pubNoPhoto.data));

// Hatalı dosya türü
const fake = await A(`/api/crm/vehicles/${id}/photos`, { method: "POST", body: await fileForm("files", "tests/fixtures/fake.jpg", "fake.jpg", "image/jpeg") });
check("Sahte görsel dosyası reddedilir", fake.status === 422, JSON.stringify(fake.data));

// 3. Fotoğraf yükleme
const up = await A(`/api/crm/vehicles/${id}/photos`, { method: "POST", body: await fileForm("files", "tests/fixtures/car.jpg", "bmw.jpg", "image/jpeg") });
check("3. Fotoğraf yüklendi", up.status === 201, JSON.stringify(up.data));

// Video + PDF
const vid = await A(`/api/crm/vehicles/${id}/video`, { method: "POST", body: await fileForm("file", "tests/fixtures/sample.mp4", "tanitim.mp4", "video/mp4") });
check("Video yüklendi", vid.status === 201, JSON.stringify(vid.data));
const pdf = await A(`/api/crm/vehicles/${id}/expertise`, { method: "POST", body: await fileForm("file", "tests/fixtures/ekspertiz.pdf", "ekspertiz.pdf", "application/pdf") });
check("Ekspertiz PDF yüklendi", pdf.status === 201, JSON.stringify(pdf.data));

// 4. Ekspertiz/özellik düzenleme
const edit = await A(`/api/crm/vehicles/${id}`, {
  method: "PATCH",
  json: {
    brand: "BMW", model: "5 Serisi", packageName: "520i M Sport E2E", year: 2023, km: 12000, price: 3_675_000,
    fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Siyah", equipment: ["Deri koltuk", "Head-up display", "360° kamera"],
    paintedParts: "Yok", changedParts: "Yok", damageNote: "Hasarsız", tramerAmount: 0, expertiseSummary: "Motor ve şanzıman temiz (test)",
  },
});
check("4. Ekspertiz ve özellikler güncellendi", edit.status === 200, JSON.stringify(edit.data));

// 5. Yayımla
const pub = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "publish" } });
check("5. Araç yayımlandı", pub.status === 200 && pub.data.status === "AVAILABLE", JSON.stringify(pub.data));

// 6-7. Listede + filtreler
const list = await publicHtml("/araclar");
check("6. İlan müşteri listesinde görünüyor", list.html.includes(`/araclar/${id}`));
const filtered = await publicHtml("/araclar?marka=BMW&minFiyat=3000000&maxFiyat=4000000");
check("7. Marka+fiyat filtresi BMW'yi buluyor", filtered.html.includes(`/araclar/${id}`));
const filteredOut = await publicHtml("/araclar?marka=BMW&maxFiyat=3000000");
check("7b. Fiyat aralığı dışındaki BMW filtrelenir", !filteredOut.html.includes(`/araclar/${id}`));
const otherBrand = await publicHtml("/araclar?marka=Audi");
check("7c. Başka marka filtresinde görünmez", !otherBrand.html.includes(`/araclar/${id}`));
const sorted = await publicHtml("/araclar?sirala=price_asc");
check("Sıralama parametresi çalışır (200)", sorted.status === 200);

// 8. Detay + video
const detail = await publicHtml(`/araclar/${id}`);
check("8. Detay sayfası açılıyor", detail.status === 200 && detail.html.includes("520i M Sport E2E"));
check("8b. Detayda video oynatıcı var", detail.html.includes("<video"));
check("8c. Ekspertiz PDF'i müşteri sayfasında yok", !detail.html.includes("/api/crm/files/"));
const videoSrc = detail.html.match(/\/media\/[^"]+\.mp4/)?.[0];
const range = videoSrc ? await fetch(`${BASE}${videoSrc}`, { headers: { Range: "bytes=0-99" } }) : null;
check("8d. Video Range isteğiyle servis ediliyor (206)", range?.status === 206, range?.status);

// 9. Ahmet opsiyonlar
const opt = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "option" } });
check("9. Ahmet aracı opsiyonladı", opt.status === 200 && opt.data.status === "OPTIONED", JSON.stringify(opt.data));

// 10. Opsiyonlu etiketi
const detail2 = await publicHtml(`/araclar/${id}`);
check("10. Müşteri sitesinde 'Opsiyonlu' etiketi", detail2.html.includes("Opsiyonlu"));

// 11. Mehmet engellenir
const mSale = await M(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "startSale" } });
check("11. Mehmet satış başlatamaz (409)", mSale.status === 409, JSON.stringify(mSale.data));
console.log(`      sunucu mesajı: ${mSale.data.error}`);
const mOpt = await M(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "option" } });
check("11b. Mehmet opsiyonlayamaz (409)", mOpt.status === 409);
const mRel = await M(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "releaseOption" } });
check("11c. Mehmet Ahmet'in opsiyonunu kaldıramaz", mRel.status === 409);
const mEdit = await M(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { brand: "BMW", model: "5 Serisi", year: 2023, km: 1, price: 1, fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan" } });
check("11d. Mehmet opsiyonlu aracın bilgilerini değiştiremez", mEdit.status === 409, mEdit.status);
const mPhoto = await M(`/api/crm/vehicles/${id}/photos`, { method: "POST", body: await fileForm("files", "tests/fixtures/car.jpg", "x.jpg", "image/jpeg") });
check("11e. Mehmet opsiyonlu araca fotoğraf ekleyemez", mPhoto.status === 409, mPhoto.status);
const aEdit = await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { brand: "BMW", model: "5 Serisi", packageName: "520i M Sport E2E", year: 2023, km: 12000, price: 3_675_000, fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan" } });
check("11f. Opsiyon sahibi Ahmet düzenleyebilir", aEdit.status === 200, aEdit.status);

// 12. Satış süreci
const start = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "startSale", agreedPrice: 3_600_000 } });
check("12. Ahmet satış sürecini başlattı", start.status === 200 && start.data.status === "SALE_PENDING", JSON.stringify(start.data));
const hiddenList = await publicHtml("/araclar");
check("12b. Satış bekleyen araç listeden gizli", !hiddenList.html.includes(`/araclar/${id}`));
const hiddenDetail = await publicHtml(`/araclar/${id}`);
check("12c. Satış bekleyen aracın detayı aktif ilan göstermez (404)", hiddenDetail.status === 404 && hiddenDetail.html.includes("artık yayında değil"));
const noNotary = await Y(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "completeSale", notaryCompleted: false } });
check("12d. Noter onayı olmadan satış tamamlanamaz", noNotary.status === 422);
const mComplete = await M(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "completeSale", notaryCompleted: true } });
check("12e. Yetkisiz personel (Mehmet) satışı tamamlayamaz", mComplete.status === 403, mComplete.status);
const done = await Y(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "completeSale", notaryCompleted: true, notaryDate: "2026-10-22" } });
check("12f. Yönetici noter devriyle satışı tamamladı", done.status === 200 && done.data.status === "SOLD", JSON.stringify(done.data));

// 13. Kaldırıldı
const soldList = await publicHtml("/araclar");
const soldDetail = await publicHtml(`/araclar/${id}`);
check("13. Satılan araç listeden kaldırıldı", !soldList.html.includes(`/araclar/${id}`));
check("13b. Eski detay bağlantısı aktif ilan göstermiyor (404)", soldDetail.status === 404 && !soldDetail.html.includes("WhatsApp ile bilgi al"));
const reopen = await Y(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "option" } });
const reedit = await Y(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { brand: "X", model: "Y", year: 2020, km: 1, price: 1, fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan" } });
check("13c. Satılmış araç yeniden satışa açılamaz / düzenlenemez", reopen.status === 409 && reedit.status === 409);

// 14. CRM kaydı
const crm = await Y(`/crm/vehicles/${id}`);
check("14. CRM'de satış kaydı ve geçmiş korunuyor", crm.status === 200 && crm.data.includes("Satış kayıtları") && crm.data.includes("Satış tamamlandı"));
const dash = await Y(`/crm`);
check("14b. CRM özet ekranı açılıyor", dash.status === 200 && dash.data.includes("Satılan araçlar"));

// Ek: eşzamanlı opsiyon
const list2 = await publicHtml("/araclar");
const otherId = [...list2.html.matchAll(/\/araclar\/(c[a-z0-9]{20,})/g)].map((m) => m[1]).find((x) => x !== id);
if (otherId) {
  const [r1, r2] = await Promise.all([
    A(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "option" } }),
    M(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "option" } }),
  ]);
  const okCount = [r1, r2].filter((r) => r.status === 200).length;
  check("Eşzamanlı iki opsiyon isteğinden yalnızca biri başarılı", okCount === 1, `${r1.status}/${r2.status}`);
  await Y(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "releaseOption" } });
}

console.log(failures === 0 ? "\nTÜM E2E KONTROLLERİ GEÇTİ" : `\n${failures} KONTROL BAŞARISIZ`);
process.exit(failures ? 1 : 0);
