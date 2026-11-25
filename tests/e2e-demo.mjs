// Demo senaryosunun (14 adım) çalışan sunucuya karşı HTTP üzerinden uçtan uca testi.
// Kullanım: önce `npm run db:reset` ve sunucuyu başlatın, sonra: node tests/e2e-demo.mjs [http://localhost:3000]
// Canlı (Vercel) adres için ortam değişkenleri:
//   E2E_PASSWORD_YONETICI / E2E_PASSWORD_AHMET / E2E_PASSWORD_MEHMET   personel şifreleri (her biri farklı)
//   E2E_ACCESS     "kullanıcı:şifre" — demo erişim kapısı (DEMO_ACCESS_USER:DEMO_ACCESS_PASSWORD)
//   E2E_DIRECT=1   dosyaları Vercel Blob'a doğrudan yükle (sunucu Blob sürücüsündeyse)
import { readFile } from "fs/promises";
import { upload } from "@vercel/blob/client";

const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
// Yerel demo şifreleri (prisma/seed.ts → LOCAL_DEMO_PASSWORDS); her personelin şifresi farklıdır.
const PASSWORDS = {
  "yonetici@mirmotors.demo": process.env.E2E_PASSWORD_YONETICI || "MirYonetici2026!",
  "ahmet@mirmotors.demo": process.env.E2E_PASSWORD_AHMET || "MirAhmet2026!",
  "mehmet@mirmotors.demo": process.env.E2E_PASSWORD_MEHMET || "MirMehmet2026!",
};
const ACCESS = process.env.E2E_ACCESS ? `Basic ${Buffer.from(process.env.E2E_ACCESS).toString("base64")}` : null;
const DIRECT = process.env.E2E_DIRECT === "1";
let failures = 0;

// Erişim kapısı varsa yalnızca demo adresine giden isteklere Basic yetkilendirme eklenir.
const rawFetch = globalThis.fetch;
globalThis.fetch = (url, init = {}) => {
  if (ACCESS && String(url).startsWith(BASE) && !init.noAccess) init = { ...init, headers: { authorization: ACCESS, ...(init.headers || {}) } };
  return rawFetch(url, init);
};

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && extra ? `  →  ${extra}` : ""}`);
  if (!cond) failures++;
}

async function login(email, password = PASSWORDS[email]) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
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

/**
 * Araca dosya yükler: yerelde form verisiyle, Blob ortamında arayüzle aynı yoldan
 * (yükleme jetonu → doğrudan Blob'a yükleme → yolu API'ye kaydetme).
 */
async function uploadFile(call, cookie, vehicleId, kind, path, name, type) {
  const route = { photo: "photos", video: "video", pdf: "expertise" }[kind];
  if (!DIRECT) {
    return call(`/api/crm/vehicles/${vehicleId}/${route}`, { method: "POST", body: await fileForm(kind === "photo" ? "files" : "file", path, name, type) });
  }
  const rel = `${vehicleId}/${crypto.randomUUID()}${name.slice(name.lastIndexOf("."))}`;
  try {
    await upload(`${kind === "pdf" ? "private" : "public"}/${rel}`, new Blob([await readFile(path)], { type }), {
      access: "private",
      handleUploadUrl: `${BASE}/api/crm/uploads`,
      headers: { cookie, ...(ACCESS ? { authorization: ACCESS } : {}) },
      clientPayload: JSON.stringify({ target: "vehicle", kind, vehicleId }),
      contentType: type,
    });
  } catch (e) {
    // Sunucu yükleme jetonunu reddettiyse (yetki/kural) Blob istemcisi "client token" hatası verir.
    return { status: /client token/i.test(String(e.message)) ? 409 : 400, data: String(e.message) };
  }
  return call(`/api/crm/vehicles/${vehicleId}/${route}`, { method: "POST", json: kind === "photo" ? { paths: [rel] } : { path: rel } });
}

const publicHtml = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, html: await res.text(), headers: res.headers };
};

// --- Güvenlik ---
if (ACCESS) {
  // Varsayılan kapsam: müşteri sitesi açık, CRM erişim şifresi ister (DEMO_ACCESS_SCOPE=all ise site de korunur).
  const site = await fetch(`${BASE}/araclar`, { noAccess: true });
  check("Müşteri sitesi erişim şifresi olmadan açılır", site.status === 200 || (process.env.E2E_SCOPE === "all" && site.status === 401), site.status);
  const gateCrm = await fetch(`${BASE}/crm/login`, { noAccess: true });
  check("Demo erişim kapısı: CRM şifresiz açılmaz (401)", gateCrm.status === 401, gateCrm.status);
  const gateApi = await fetch(`${BASE}/api/auth/login`, { method: "POST", noAccess: true, headers: { "Content-Type": "application/json" }, body: "{}" });
  check("Demo erişim kapısı: giriş API'si şifresiz kapalı (401)", gateApi.status === 401, gateApi.status);
}
{
  const r = await fetch(`${BASE}/api/crm/vehicles`, { method: "POST", body: "{}" });
  check("Oturumsuz CRM API isteği reddedilir (401)", r.status === 401, r.status);
  const p = await fetch(`${BASE}/crm`, { redirect: "manual" });
  check("Oturumsuz CRM sayfası girişe yönlendirir", p.status === 307 && p.headers.get("location")?.includes("/crm/login"), p.status);
  const bad = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "ahmet@mirmotors.demo", password: "yanlis" }) });
  check("Yanlış şifre reddedilir", bad.status === 401);
  const home = await publicHtml("/");
  check("Site noindex başlığı taşır", (home.headers.get("x-robots-tag") || "").includes("noindex"));
  check("Sitede DEMO etiketi yok (23.11.2026 kararı)", !home.html.includes(">DEMO<") && !home.html.includes("Demo sürüm"));
}

// 1. Giriş
const admin = await login("yonetici@mirmotors.demo");
const ahmet = await login("ahmet@mirmotors.demo");
const mehmet = await login("mehmet@mirmotors.demo");
check("1. Personel girişi (yönetici, Ahmet, Mehmet)", admin.ok && ahmet.ok && mehmet.ok);
{
  const cross = await login("yonetici@mirmotors.demo", PASSWORDS["ahmet@mirmotors.demo"]);
  check("Güvenlik: satış personelinin şifresi yönetici hesabını açmaz (ayrı şifreler)", !cross.ok);
}
const A = client(ahmet.cookie), M = client(mehmet.cookie), Y = client(admin.cookie);
// Her çalıştırmada farklı test plakası: önceki çalıştırmalardan kalan test araçları aynı plaka uyarısına takılmasın
const RUN = crypto.randomUUID().replace(/[^0-9]/g, "").slice(0, 4).padEnd(4, "0");

// 2. Yeni BMW
const create = await A("/api/crm/vehicles", {
  method: "POST",
  json: {
    brand: "BMW", model: "5 Serisi", packageName: "520i M Sport E2E", year: 2023, km: 12000, price: 3_675_000,
    fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Siyah", equipment: ["Deri koltuk", "Head-up display"],
    enginePower: 170, engineCc: 1998, drivetrain: "Arkadan İtiş", damageRecord: "NONE", tramerAmount: 0, expertiseSummary: "Temiz (test)",
  },
});
check("2. Yeni BMW taslak olarak oluşturuldu", create.status === 201 && create.data.id, JSON.stringify(create.data));
const id = create.data.id;

// Fotoğrafsız yayımlama engeli
const pubNoPhoto = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "publish" } });
check("Fotoğraf olmadan yayımlanamaz (422)", pubNoPhoto.status === 422, JSON.stringify(pubNoPhoto.data));

// Hatalı dosya türü
const fake = await uploadFile(A, ahmet.cookie, id, "photo", "tests/fixtures/fake.jpg", "fake.jpg", "image/jpeg");
check("Sahte görsel dosyası reddedilir", fake.status === 422, JSON.stringify(fake.data));

// 3. Fotoğraf yükleme
const up = await uploadFile(A, ahmet.cookie, id, "photo", "tests/fixtures/car.jpg", "bmw.jpg", "image/jpeg");
check("3. Fotoğraf yüklendi", up.status === 201, JSON.stringify(up.data));

// Taslak aracın medyası müşteriye kapalı (oturumsuz 404), personele açık
const crmDraft = await A(`/crm/vehicles/${id}`);
const photoUrl = typeof crmDraft.data === "string" ? crmDraft.data.match(/\/media\/[^"]+\.(?:jpg|webp)/)?.[0] : null;
{
  const anon = photoUrl ? await fetch(`${BASE}${photoUrl}`) : null;
  const staff = photoUrl ? await fetch(`${BASE}${photoUrl}`, { headers: { cookie: ahmet.cookie } }) : null;
  check("Taslak aracın fotoğrafı müşteriye kapalı (404), personel görür", anon?.status === 404 && staff?.status === 200, `${anon?.status}/${staff?.status}`);
}

// Video + PDF
const vid = await uploadFile(A, ahmet.cookie, id, "video", "tests/fixtures/sample.mp4", "tanitim.mp4", "video/mp4");
check("Video yüklendi", vid.status === 201, JSON.stringify(vid.data));
const pdf = await uploadFile(A, ahmet.cookie, id, "pdf", "tests/fixtures/ekspertiz.pdf", "ekspertiz.pdf", "application/pdf");
check("Ekspertiz PDF yüklendi", pdf.status === 201, JSON.stringify(pdf.data));
{
  const crmPage = await A(`/crm/vehicles/${id}`);
  const pdfUrl = typeof crmPage.data === "string" ? crmPage.data.match(/\/api\/crm\/files\/[^"]+\.pdf/)?.[0] : null;
  const anon = pdfUrl ? await fetch(`${BASE}${pdfUrl}`) : null;
  const staff = pdfUrl ? await fetch(`${BASE}${pdfUrl}`, { headers: { cookie: ahmet.cookie } }) : null;
  const body = staff ? Buffer.from(await staff.arrayBuffer()).subarray(0, 5).toString("ascii") : "";
  check("Ekspertiz PDF'i oturumsuz açılmaz (401), personel açar", anon?.status === 401 && staff?.status === 200 && body === "%PDF-", `${anon?.status}/${staff?.status}`);
}

// 4. Ekspertiz/özellik düzenleme
const edit = await A(`/api/crm/vehicles/${id}`, {
  method: "PATCH",
  json: {
    brand: "BMW", model: "5 Serisi", packageName: "520i M Sport E2E", year: 2023, km: 12000, price: 3_675_000,
    fuel: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Siyah", equipment: ["Deri koltuk", "Head-up display", "360° kamera"],
    enginePower: 170, engineCc: 1998, drivetrain: "Arkadan İtiş", damageRecord: "NONE", damageNote: "Hasarsız", tramerAmount: 0,
    expertiseSummary: "Motor ve şanzıman temiz (test)",
  },
});
check("4. Ekspertiz ve özellikler güncellendi", edit.status === 200, JSON.stringify(edit.data));

// Kaporta şeması: tüm parçalar personelce doğrulanır; sağ ön kapı değişen, sol ön çamurluk boyalı
const PARTS = ["FRONT_BUMPER", "HOOD", "ROOF", "TRUNK", "REAR_BUMPER", "LEFT_FRONT_FENDER", "LEFT_FRONT_DOOR", "LEFT_REAR_DOOR", "LEFT_REAR_FENDER", "RIGHT_FRONT_FENDER", "RIGHT_FRONT_DOOR", "RIGHT_REAR_DOOR", "RIGHT_REAR_FENDER"];
{
  const partial = await A(`/api/crm/vehicles/${id}/parts`, { method: "PUT", json: { updates: [{ part: "RIGHT_FRONT_DOOR", state: "CHANGED" }] } });
  check("Kaporta: tek parça kaydedildi", partial.status === 200 && partial.data.summary.changedCount === 1 && partial.data.summary.bodyVerified === false, JSON.stringify(partial.data));
  const bad = await A(`/api/crm/vehicles/${id}/parts`, { method: "PUT", json: { updates: [{ part: "UCAN_KAPI", state: "CHANGED" }] } });
  check("Kaporta: geçersiz parça reddedilir", bad.status === 422, bad.status);
  const all = await A(`/api/crm/vehicles/${id}/parts`, {
    method: "PUT",
    json: { updates: PARTS.filter((p) => p !== "RIGHT_FRONT_DOOR").map((p) => ({ part: p, state: p === "LEFT_FRONT_FENDER" ? "PAINTED" : "ORIGINAL" })) },
  });
  const sm = all.data.summary || {};
  check("Kaporta: 13 parça ayrı kaydedildi, sayaçlar doğru", all.status === 200 && sm.bodyVerified && sm.paintedCount === 1 && sm.changedCount === 1 && sm.localPaintCount === 0, JSON.stringify(sm));
  const conflict = await A(`/api/crm/vehicles/${id}/parts`, { method: "PUT", json: { updates: [{ part: "HOOD", reportState: "PAINTED" }] } });
  const crmBody = await A(`/crm/vehicles/${id}`);
  check("Kaporta: ekspertiz raporuyla çelişki uyarısı", conflict.status === 200 && crmBody.data.includes("Ekspertiz raporuyla çelişki"), conflict.status);
  check("Kaporta: değişiklik işlem geçmişine personel adıyla yazıldı", crmBody.data.includes("Kaporta şeması güncellendi") && crmBody.data.includes("Sağ ön kapı: Değişen"));
}

// Eksik bilgiyle AI taslağı (hata vermez), personel onayı zorunlu, yayımlamada eksikler istenir
{
  const noReview = await A("/api/crm/vehicles", { method: "POST", json: { brand: "Toyota", aiDraftMode: "SIMULATION" } });
  check("AI taslağı: personel onayı olmadan kaydedilmez (422)", noReview.status === 422, noReview.status);
  const partialDraft = await A("/api/crm/vehicles", { method: "POST", json: { brand: "Toyota", aiDraftMode: "SIMULATION", aiReviewed: true } });
  check("AI taslağı: eksik bilgiyle taslak oluşturulur (201)", partialDraft.status === 201, JSON.stringify(partialDraft.data));
  const pid = partialDraft.data.id;
  if (pid) {
    await uploadFile(A, ahmet.cookie, pid, "photo", "tests/fixtures/car.jpg", "t.jpg", "image/jpeg");
    const pubPartial = await A(`/api/crm/vehicles/${pid}/transition`, { method: "POST", json: { action: "publish" } });
    check("AI taslağı: eksik bilgiyle yayımlanamaz, eksikler listelenir (422)", pubPartial.status === 422 && /fiyat/i.test(String(pubPartial.data.error)), JSON.stringify(pubPartial.data));
  }
}

// Zorunlu ilan bilgileri (Yönetmelik m.20/2, 21/1-a): eksikken yayın engellenir, nedenleri tek tek bildirilir.
// İşletme bilgileri boşsa test süresince açıkça "TEST" işaretli değerler girilir ve sonda geri alınır.
let companyRestore = null;
{
  const ayarlar = await Y("/crm/ayarlar");
  const filled = typeof ayarlar.data === "string" && /id="title"[^>]*value="[^"]+"/.test(ayarlar.data) && /id="authorizationNo"[^>]*value="[^"]+"/.test(ayarlar.data);
  if (!filled) {
    const set = await Y("/api/crm/settings", { method: "PUT", json: { title: "TEST E2E Otomotiv (test kaydı)", authorizationNo: "TEST-E2E", mersis: null, address: null } });
    check("Test için işletme bilgileri (TEST) girildi", set.status === 200, set.status);
    companyRestore = { title: null, authorizationNo: null, mersis: null, address: null };
  }
  const missing = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "publish" } });
  const err = String(missing.data?.error ?? "");
  check("Yayın: şasi son 6 hane eksikken yayımlanamaz, neden açıkça yazılır", missing.status === 422 && err.includes("İlan yayımlanamıyor: Şasi numarasının son 6 hanesi eksik."), err);
  check("Yayın: plaka eksikken yayımlanamaz", err.includes("İlan yayımlanamıyor: Plaka eksik."), err);
  check("Yayın: rehin/haciz girilmeden yayımlanamaz", err.includes("Rehin/haciz durumu girilmedi."), err);
  check("Yayın: kaporta raporla çelişirken yayımlanamaz", err.includes("ekspertiz raporuyla çelişiyor"), err);

  // Eksik bilgiyle taslak kaydı mümkün; yalnızca yayın engellenir
  const legal = { vehicleClass: "Otomobil", vehicleType: "TEST-G30", legalPlate: `00 TEST ${RUN}`, legalVin: "TST123", damageRecord: "NONE", legalLien: "", warrantyStatus: "", legalRegisteredToCompany: "true" };
  const save = await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: legal });
  check("Taslak: rehin/haciz ve garanti girilmeden kaydedilebilir", save.status === 200, JSON.stringify(save.data));
  const oldVal = await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { legalLien: "UNVERIFIED" } });
  check("Kaldırılan \"Doğrulanmadı\" seçeneği artık kabul edilmez", oldVal.status >= 400 && oldVal.status < 500 && oldVal.data?.error === "Rehin / haciz durumunu seçin", `${oldVal.status} ${JSON.stringify(oldVal.data)}`);
  await A(`/api/crm/vehicles/${id}/parts`, { method: "PUT", json: { updates: [{ part: "HOOD", reportState: "UNKNOWN" }] } });
  const unverified = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "publish" } });
  const err2 = String(unverified.data?.error ?? "");
  check("Yayın: rehin/haciz girilmediyse yayımlanamaz", unverified.status === 422 && err2.includes("İlan yayımlanamıyor: Rehin/haciz durumu girilmedi."), err2);
  check("Yayın: garanti girilmediyse yayımlanamaz (boş ≠ yok)", err2.includes("Garanti durumu girilmedi."), err2);
  check("Yayın: tamamlanan maddeler artık listelenmez (şasi, plaka)", !err2.includes("Şasi") && !err2.includes("Plaka eksik"), err2);

  const active = await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { legalLien: "NONE", warrantyStatus: "ACTIVE" } });
  const noKm = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "publish" } });
  check("Garanti devam ediyorsa kalan süre ve km istenir", active.status === 200 && noKm.status === 422 && String(noKm.data?.error).includes("bitiş tarihi ve bitiş kilometresi"), String(noKm.data?.error));
  await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { warrantyStatus: "NONE" } });
}

// 5. Yayımla
const pub = await A(`/api/crm/vehicles/${id}/transition`, { method: "POST", json: { action: "publish" } });
check("5. Araç yayımlandı (garanti devam etmiyorsa garanti tarih/km istenmez)", pub.status === 200 && pub.data.status === "AVAILABLE", JSON.stringify(pub.data));
{
  const broke = await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { legalLien: "" } });
  check("Yayındaki ilanda rehin/haciz boşaltılamaz (422)", broke.status === 422 && String(broke.data?.error).includes("Rehin/haciz durumu girilmedi."), JSON.stringify(broke.data));
  const blankVin = await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { legalVin: "" } });
  check("Yayındaki ilanda şasi son 6 hane silinemez (422)", blankVin.status === 422 && String(blankVin.data?.error).includes("Şasi numarasının son 6 hanesi eksik."), JSON.stringify(blankVin.data));
  const okEdit = await A(`/api/crm/vehicles/${id}`, { method: "PATCH", json: { description: "E2E açıklama" } });
  check("Yayındaki ilanda kısmi düzenleme diğer bilgileri silmez (200)", okEdit.status === 200, JSON.stringify(okEdit.data));
}

// 6-7. Listede + filtreler
const list = await publicHtml("/araclar");
check("6. İlan müşteri listesinde görünüyor", list.html.includes(`/araclar/${id}`));
const filtered = await publicHtml("/araclar?marka=BMW&minFiyat=3000000&maxFiyat=4000000");
check("7. Marka+fiyat filtresi BMW'yi buluyor", filtered.html.includes(`/araclar/${id}`));
const filteredOut = await publicHtml("/araclar?marka=BMW&maxFiyat=3000000");
check("7b. Fiyat aralığı dışındaki BMW filtrelenir", !filteredOut.html.includes(`/araclar/${id}`));
const otherBrand = await publicHtml("/araclar?marka=Audi");
check("7c. Başka marka filtresinde görünmez", !otherBrand.html.includes(`/araclar/${id}`));
// Arama ve tüm filtreler (yeni listeleme sayfası): hedef araç dahil / hariç
const has = async (qs) => (await publicHtml(`/araclar?${qs}`)).html.includes(`/araclar/${id}`);
const filterCases = [
  ["q=520i", true], ["q=bmw 520i", true], ["q=Audi", false],
  ["kasa=Sedan", true], ["kasa=SUV", false],
  ["yakit=Benzin", true], ["yakit=Dizel", false],
  ["vites=Otomatik", true], ["vites=Manuel", false],
  ["minYil=2023", true], ["maxYil=2022", false],
  ["maxKm=20000", true], ["minKm=20000", false],
  ["minFiyat=3500000&maxFiyat=5000000", true], ["minFiyat=5000000", false],
  ["marka=BMW&model=5 Serisi", true], ["marka=BMW&model=X5", false],
  ["durum=AVAILABLE", true], ["durum=OPTIONED", false],
  ["gorunum=liste", true], ["gorunum=liste&q=520i&kasa=Sedan", true],
];
for (const [qs, expected] of filterCases) {
  const got = await has(encodeURI(qs));
  check(`Filtre ${qs} → ${expected ? "dahil" : "hariç"}`, got === expected, `got ${got}`);
}
const sorted = await publicHtml("/araclar?sirala=price_asc");
check("Sıralama parametresi çalışır (200)", sorted.status === 200);

// Belgelerden AI ile araç (V1.2): arka plan analizi, Kontrol Bekliyor, inceleme, mükerrer belge, yetki
{
  // Her yüklemede farklı içerik (aynı dosya kontrolüne takılmasın): JPEG sonuna rastgele bayt
  const uniqueJpeg = async () => Buffer.concat([await readFile("tests/fixtures/car.jpg"), Buffer.from(crypto.randomUUID())]);
  const startDocs = async (method, docs, extra = {}) => {
    if (DIRECT) {
      const files = [];
      for (const [kind, buf] of docs) {
        const rel = `docs/${crypto.randomUUID()}.jpg`;
        await upload(`private/${rel}`, new Blob([buf], { type: "image/jpeg" }), {
          access: "private", handleUploadUrl: `${BASE}/api/crm/uploads`,
          headers: { cookie: ahmet.cookie, ...(ACCESS ? { authorization: ACCESS } : {}) },
          clientPayload: JSON.stringify({ target: "docDraft" }), contentType: "image/jpeg",
        });
        files.push({ kind, path: rel });
      }
      return A("/api/crm/doc-analyses", { method: "POST", json: { method, masked: extra.masked ?? true, simulation: true, vehicleId: extra.vehicleId, files } });
    }
    const fd = new FormData();
    fd.append("method", method);
    if (extra.masked ?? true) fd.append("masked", "1");
    fd.append("simulation", "1");
    if (extra.vehicleId) fd.append("vehicleId", extra.vehicleId);
    for (const [kind, buf] of docs) fd.append(kind.toLowerCase(), new Blob([buf], { type: "image/jpeg" }), `${kind}.jpg`);
    return A("/api/crm/doc-analyses", { method: "POST", body: fd });
  };
  const poll = async (aid) => {
    for (let i = 0; i < 90; i++) {
      const st = await A(`/api/crm/doc-analyses/${aid}`);
      if (["REVIEW", "ERROR", "CANCELLED", "DONE"].includes(st.data.status)) return st.data;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { status: "TIMEOUT" };
  };

  const unmasked = await startDocs("RUHSAT", [["RUHSAT", await uniqueJpeg()]], { masked: false });
  check("Belge: kişisel veriler maskelenmeden AI analizi başlatılamaz (422)", unmasked.status === 422, unmasked.status);
  const wrong = await startDocs("RUHSAT", [["FORM", await uniqueJpeg()]]);
  check("Belge: yönteme uymayan belge türü reddedilir", wrong.status === 400, wrong.status);
  const eksp = await startDocs("AUTO", [["EKSPERTIZ", await uniqueJpeg()]]);
  check("Belge: dış ekspertiz raporu artık yüklenmez (400)", eksp.status === 400 && /kontrol formu/i.test(String(eksp.data.error)), JSON.stringify(eksp.data));
  const anon = await fetch(`${BASE}/api/crm/doc-analyses`, { method: "POST", noAccess: true });
  check("Belge: oturumsuz analiz başlatılamaz", anon.status === 401, anon.status);

  const docs = [["RUHSAT", await uniqueJpeg()], ["FORM", await uniqueJpeg()], ["FORM", await uniqueJpeg()]];
  const started = await startDocs("AUTO", docs);
  check("Belge: analiz arka planda başladı (202)", started.status === 202 && started.data.id, JSON.stringify(started.data));
  const result = started.data.id ? await poll(started.data.id) : {};
  check("Belge: analiz Kontrol Bekliyor durumuna ulaştı ve araç oluştu", result.status === "REVIEW" && result.vehicleId && result.mode === "SIMULATION", JSON.stringify(result));
  const vid = result.vehicleId;
  if (vid) {
    const page = await A(`/crm/vehicles/${vid}`);
    check("Belge: araç sayfasında Kontrol Bekliyor, belge kontrolü ve A/B/C grupları var",
      page.data.includes("Kontrol Bekliyor") && page.data.includes("Belgede tespit edilen bilgiler") && page.data.includes("Eksik veya belirsiz") && page.data.includes("Çelişkili bilgiler"));
    const docPath = page.data.match(/\/api\/crm\/files\/(docs\/[^"]+\.(?:jpg|webp))/)?.[1];
    const anonDoc = docPath ? await fetch(`${BASE}/api/crm/files/${docPath}`, { noAccess: true }) : null;
    const anonMedia = docPath ? await fetch(`${BASE}/media/${docPath}`) : null;
    const mDoc = docPath ? await fetch(`${BASE}/api/crm/files/${docPath}`, { headers: { cookie: mehmet.cookie } }) : null;
    check("Belge: belge görseli müşteriye kapalı (401/404), personel görür", [401, 404].includes(anonDoc?.status) && anonMedia?.status === 404 && mDoc?.status === 200, `${anonDoc?.status}/${anonMedia?.status}/${mDoc?.status}`);

    const dup = await startDocs("AUTO", docs);
    check("Belge: aynı belgelerin tekrar yüklenmesi ikinci taslak oluşturmaz (409)", dup.status === 409 && dup.data.vehicleId === vid, JSON.stringify(dup.data));

    await uploadFile(A, ahmet.cookie, vid, "photo", "tests/fixtures/car.jpg", "doc-arac.jpg", "image/jpeg");
    const pubReview = await A(`/api/crm/vehicles/${vid}/transition`, { method: "POST", json: { action: "publish" } });
    check("Belge: Kontrol Bekliyor araç yayımlanamaz", pubReview.status === 422 && /kontrol/i.test(pubReview.data.error), JSON.stringify(pubReview.data));
    const early = await A(`/api/crm/vehicles/${vid}/transition`, { method: "POST", json: { action: "completeReview" } });
    check("Belge: onaylar verilmeden kontrol tamamlanamaz", early.status === 422, JSON.stringify(early.data));

    const ident = await A(`/api/crm/vehicles/${vid}/review`, { method: "POST", json: { action: "confirmIdentity" } });
    const owner = await A(`/api/crm/vehicles/${vid}/review`, { method: "POST", json: { action: "ownerChecked", value: true } });
    const ai = await A(`/api/crm/vehicles/${vid}/review`, { method: "POST", json: { action: "confirmAi", value: true } });
    check("Belge: personel eşleşmeyi, tescili ve AI bilgilerini onayladı", ident.status === 200 && owner.status === 200 && ai.status === 200, `${ident.status}/${owner.status}/${ai.status}`);
    const done = await A(`/api/crm/vehicles/${vid}/transition`, { method: "POST", json: { action: "completeReview" } });
    check("Belge: kontrol tamamlandı → Taslak", done.status === 200 && done.data.status === "DRAFT", JSON.stringify(done.data));

    const wiz = await A(`/crm/vehicles/${vid}/tamamla?adim=2`);
    check("Sihirbaz: taslak araç adım adım tamamlanabiliyor (kaporta + hasar + yasal adımı)", wiz.status === 200 && wiz.data.includes("wizard-steps") && wiz.data.includes("Şerh, garanti ve satış yetkisi"), wiz.status);
    const detail = await A(`/crm/vehicles/${vid}`);
    check("Yayın kontrolü: zorunlu ilan bilgileri ve galeri kuralları ayrı listeleniyor", detail.data.includes("İlanda bulunması zorunlu bilgiler") && detail.data.includes("Galeri kuralları") && detail.data.includes("EİDS doğrulaması: yapılmadı"));
    check("İlan numarası araç oluşturulurken otomatik verildi", detail.data.includes(`MM-${vid.slice(-6).toUpperCase()}`));
    check("CRM ekranında teknik ayar adı görünmüyor", !detail.data.includes("REQUIRE_LEGAL_FIELDS") && !detail.data.includes("Demo modu"));

    const fix = await A(`/api/crm/vehicles/${vid}`, { method: "PATCH", json: { brand: "Fiat", model: "Egea", year: 2019, km: 85000, price: 950000, fuel: "Benzin", transmission: "Manuel", bodyType: "Sedan" } });
    check("Belge: AI bilgisini personel elle düzeltti", fix.status === 200, fix.status);

    const add = await startDocs("ADD", [["FORM", await uniqueJpeg()], ["FORM", await uniqueJpeg()]], { vehicleId: vid });
    const addRes = add.data.id ? await poll(add.data.id) : {};
    const after = await A(`/crm/vehicles/${vid}`);
    check("Belge: mevcut taslağa kontrol formu eklendi; araç yeniden Kontrol Bekliyor", addRes.status === "REVIEW" && addRes.vehicleId === vid && after.data.includes("Kontrol Bekliyor"), JSON.stringify(addRes));
    check("Belge: personelin düzelttiği km ezilmedi, fark çelişki olarak gösterildi", after.data.includes("85.000") || after.data.includes("85000"));

    const docId = after.data.match(/data-doc-id="([^"]+)"/)?.[1];
    if (docId) {
      const del = await Y(`/api/crm/documents/${docId}`, { method: "DELETE" });
      check("Belge: yönetici belge görselini silebildi", del.status === 200, del.status);
    }

    // Yanlış / deneme kaydının silinmesi: yalnızca oluşturan veya yönetici, yalnızca hiç yayımlanmamış araç
    const mDel = await M(`/api/crm/vehicles/${vid}`, { method: "DELETE" });
    check("Silme: başkasının oluşturduğu Kontrol Bekliyor aracı satış personeli silemez (403)", mDel.status === 403, mDel.status);
    const aDel = await A(`/api/crm/vehicles/${vid}`, { method: "DELETE" });
    const gone = await A(`/crm/vehicles/${vid}`);
    check("Silme: oluşturan personel Kontrol Bekliyor aracı belgeleriyle sildi", aDel.status === 200 && gone.status === 404, `${aDel.status}/${gone.status}`);
  }
  // Gerçek (galeriye ait) araçlara dokunulmaz: testin kendi yayımladığı araç kullanılır
  const liveId = id;
  const pubDel = liveId ? await Y(`/api/crm/vehicles/${liveId}`, { method: "DELETE" }) : null;
  check("Silme: yayındaki araç (yönetici de olsa) silinemez (409)", pubDel?.status === 409, pubDel?.status);
  const wizLive = liveId ? await Y(`/crm/vehicles/${liveId}/tamamla`) : null;
  check("Sihirbaz: yayındaki araç sihirbazda açılmaz, araç sayfasına yönlenir", [302, 303, 307, 308].includes(wizLive?.status), wizLive?.status);
  const salesSettings = await A("/api/crm/settings", { method: "PUT", json: { title: "x", authorizationNo: null, mersis: null, address: null } });
  check("Ayarlar: işletme bilgilerini satış personeli değiştiremez (403)", salesSettings.status === 403, salesSettings.status);

  // Mir Motors Araç Kontrol Formu (simülasyon: sentetik örnek; gerçek okuma doğruluğu bu testte ölçülmez)
  const tooMany = await startDocs("AUTO", [["FORM", await uniqueJpeg()], ["FORM", await uniqueJpeg()], ["FORM", await uniqueJpeg()]]);
  check("Form: kontrol formu için en fazla 2 sayfa kabul edilir", tooMany.status === 400, tooMany.status);
  const formStart = await startDocs("AUTO", [["RUHSAT", await uniqueJpeg()], ["FORM", await uniqueJpeg()], ["FORM", await uniqueJpeg()]]);
  const formRes = formStart.data.id ? await poll(formStart.data.id) : {};
  check("Form: ruhsat + kontrol formu analizi Kontrol Bekliyor araç oluşturdu", formRes.status === "REVIEW" && !!formRes.vehicleId, JSON.stringify(formRes));
  if (formRes.vehicleId) {
    const fp = (await A(`/crm/vehicles/${formRes.vehicleId}`)).data;
    check("Form: araç sayfasında kontrol formu kaynaklı bilgiler ve belge türü görünüyor", fp.includes("Kontrol formu") && fp.includes("985.000") && fp.includes("Kontrol Bekliyor"));
    check("Form: e-Devlet yetkisi beyan olarak gösteriliyor (EİDS doğrulaması değil)", fp.includes("EİDS doğrulaması değildir"));
    const fpub = await A(`/api/crm/vehicles/${formRes.vehicleId}/transition`, { method: "POST", json: { action: "publish" } });
    check("Form: personel onayı olmadan yayımlanamaz", fpub.status === 422, fpub.status);
    const del = await A(`/api/crm/vehicles/${formRes.vehicleId}`, { method: "DELETE" });
    check("Form: test kaydı silindi", del.status === 200, del.status);
  }
}

// Ek filtreler: gelişmiş filtreler, kaporta, hasar, donanım, ekspertiz, paket, kombinasyon, ters aralık
const advancedCases = [
  ["paket=520i M Sport E2E", true], ["paket=320i M Sport", false],
  ["renk=Siyah", true], ["renk=Beyaz", false],
  ["minHp=150&maxHp=200", true], ["minHp=300", false],
  ["minCc=1500&maxCc=2000", true], ["maxCc=1600", false],
  ["cekis=Arkadan İtiş", true], ["cekis=Önden Çekiş", false],
  ["boyali=var", true], ["boyali=yok", false],
  ["degisen=var", true], ["degisen=yok", false],
  ["lokal=yok", true], ["lokal=var", false],
  ["hasar=yok", true], ["hasar=var", false],
  ["agirHasar=yok", true], ["agirHasar=var", false],
  ["ekspertiz=var", true], ["ekspertiz=yok", false],
  ["donanim=Head-up display", true], ["donanim=Head-up display,Sunroof", false],
  ["marka=BMW&model=5 Serisi&paket=520i M Sport E2E&minFiyat=3000000&maxFiyat=4000000&boyali=var&hasar=yok&donanim=Deri koltuk&yakit=Benzin", true],
  ["marka=BMW&model=5 Serisi&boyali=var&degisen=yok", false],
  ["minFiyat=5000000&maxFiyat=3500000", true],
  ["sirala=year_asc", true], ["sirala=km_asc&gorunum=liste", true],
];
for (const [qs, expected] of advancedCases) {
  const got = await has(encodeURI(qs));
  check(`Gelişmiş filtre ${qs} → ${expected ? "dahil" : "hariç"}`, got === expected, `got ${got}`);
}
{
  const dep5 = (await publicHtml(encodeURI("/araclar?marka=BMW&model=5 Serisi"))).html;
  const dep3 = (await publicHtml(encodeURI("/araclar?marka=BMW&model=3 Serisi"))).html;
  check("Marka → model → paket bağımlılığı (5 Serisi paketleri)", dep5.includes('value="520i M Sport E2E"') && !dep5.includes('value="320i M Sport"'));
  check("Marka → model → paket bağımlılığı (3 Serisi paketleri)", dep3.includes('value="320i M Sport"') && !dep3.includes('value="520i M Sport E2E"'));
  const brands = (await publicHtml("/araclar?marka=BMW")).html;
  const totalAttr = Number(brands.match(/data-total="(\d+)"/)?.[1] ?? -1);
  const cards = new Set([...brands.matchAll(/href="\/araclar\/(c[a-z0-9]{20,})"/g)].map((m) => m[1])).size;
  check("Sonuç sayısı listelenen ilanlarla aynı", totalAttr > 0 && totalAttr === cards, `${totalAttr}/${cards}`);
  const far = await publicHtml("/araclar?sayfa=99");
  check("Sayfalama: aralık dışı sayfa son sayfaya iner (200)", far.status === 200 && far.html.includes("ilan bulundu"));
  const tesla = (await publicHtml("/araclar?marka=Tesla")).html;
  const teslaId = tesla.match(/\/araclar\/(c[a-z0-9]{20,})/)?.[1];
  if (teslaId) {
    for (const f of ["boyali=yok", "degisen=yok", "lokal=yok", "hasar=yok", "agirHasar=yok"]) {
      const h = (await publicHtml(`/araclar?marka=Tesla&${f}`)).html;
      check(`Bilinmeyen kaporta/hasar bilgisi "${f}" sonucuna girmez`, !h.includes(`/araclar/${teslaId}`));
    }
    const td = (await publicHtml(`/araclar/${teslaId}`)).html;
    check("Bilinmeyen tramer \"Bilgi girilmedi\" gösterilir (0 TL / Tramer yok yazılmaz)", td.includes("Bilgi girilmedi") && td.includes("Kaporta bilgisi henüz girilmedi") && !td.includes("Tüm parçalar orijinal"));
  }
}

// 8. Detay + video
const detail0 = await publicHtml(`/araclar/${id}`);
check("8. Detay sayfası açılıyor", detail0.status === 200 && detail0.html.includes("520i M Sport E2E"));
check("8a. Detayda kaporta şeması ve özet var", detail0.html.includes('data-part="RIGHT_FRONT_DOOR"') && detail0.html.includes('data-state="CHANGED"') && detail0.html.includes("Sağ ön kapı"));
check("8a2. Detayda zorunlu ilan bilgileri bölümü var", detail0.html.includes("İlan ve yasal bilgiler") && !/EİDS onay/i.test(detail0.html));
{
  const h = detail0.html;
  check("8a3. Detayda şasinin son 6 hanesi ve plaka görünür", h.includes("TST123") && h.includes(`00 TEST ${RUN}`));
  check("8a4. Detayda araç cinsi ve tipi görünür", h.includes("Otomobil") && h.includes("TEST-G30"));
  const crmSettings = (await Y("/crm/ayarlar")).data;
  const title = String(crmSettings).match(/id="title"[^>]*value="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  const auth = String(crmSettings).match(/id="authorizationNo"[^>]*value="([^"]+)"/)?.[1];
  check("8a5. Detayda işletme unvanı ve yetki belgesi no var (Ayarlar'dan)", !!title && !!auth && h.includes(auth) && h.replace(/&amp;/g, "&").includes(title), `${title} / ${auth}`);
  check("8a6. Kaporta bilgisinin kaynağı belirtilir (resmî ekspertiz değil)", h.includes("Mir Motors araç kontrol bilgileri"));
  check("8a7. Müşteri sayfasında iç alanlar (AI izi, belge, PDF yolu) yok", !h.includes("aiDraftJson") && !h.includes("docReview") && !h.includes("expertisePdfPath") && !h.includes("/api/crm/"));
}
check("8b0. Onaylanmamış video müşteriye gösterilmez", !detail0.html.includes("<video"));
{
  const vUrl = (await A(`/crm/vehicles/${id}`)).data.match(/\/media\/[^"]+\.mp4/)?.[0];
  const anonVideo = vUrl ? await fetch(`${BASE}${vUrl}`) : null;
  check("8b1. Onaylanmamış videonun adresi oturumsuz açılmaz (404)", anonVideo?.status === 404, anonVideo?.status);
  const approve = await A(`/api/crm/vehicles/${id}/video`, { method: "PATCH", json: { public: true } });
  check("8b2. Personel videoyu müşteriye açtı", approve.status === 200, JSON.stringify(approve.data));
}
const detail = await publicHtml(`/araclar/${id}`);
check("8b. Onaydan sonra detayda video oynatıcı var", detail.html.includes("<video"));
check("8c. Ekspertiz PDF'i müşteri sayfasında yok", !detail.html.includes("/api/crm/files/"));
const videoSrc = detail.html.match(/\/media\/[^"]+\.mp4/)?.[0];
const range = videoSrc ? await fetch(`${BASE}${videoSrc}`, { headers: { Range: "bytes=0-99" } }) : null;
check("8d. Video Range isteğiyle servis ediliyor (206)", range?.status === 206, range?.status);
{
  const anonPhoto = photoUrl ? await fetch(`${BASE}${photoUrl}`) : null;
  check("8e. Yayındaki aracın fotoğrafı müşteriye açık (200, kısa önbellek)", anonPhoto?.status === 200 && !/immutable|31536000/.test(anonPhoto.headers.get("cache-control") || ""), `${anonPhoto?.status} ${anonPhoto?.headers.get("cache-control")}`);
}

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
const mPhoto = await uploadFile(M, mehmet.cookie, id, "photo", "tests/fixtures/car.jpg", "x.jpg", "image/jpeg");
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
{
  const anonPhoto = photoUrl ? await fetch(`${BASE}${photoUrl}`) : null;
  const anonVideo = videoSrc ? await fetch(`${BASE}${videoSrc}`) : null;
  const staffPhoto = photoUrl ? await fetch(`${BASE}${photoUrl}`, { headers: { cookie: admin.cookie } }) : null;
  check("13d. Satılmış aracın fotoğraf ve videosu doğrudan adresle açılmaz (404)", anonPhoto?.status === 404 && anonVideo?.status === 404, `${anonPhoto?.status}/${anonVideo?.status}`);
  check("13e. Satılmış aracın medyası CRM'de personele açık ve önbelleklenmez", staffPhoto?.status === 200 && (staffPhoto.headers.get("cache-control") || "").includes("no-store"));
}

// 14. CRM kaydı
const crm = await Y(`/crm/vehicles/${id}`);
check("14. CRM'de satış kaydı ve geçmiş korunuyor", crm.status === 200 && crm.data.includes("Satış kayıtları") && crm.data.includes("Satış tamamlandı"));
const dash = await Y(`/crm`);
check("14b. CRM özet ekranı açılıyor", dash.status === 200 && dash.data.includes("Satılan araçlar"));

// Ek: eşzamanlı opsiyon — galerinin gerçek araçlarına dokunmamak için test kendi aracını oluşturup yayımlar
const race = await Y("/api/crm/vehicles", {
  method: "POST",
  json: {
    brand: "Test", model: "Eşzamanlı E2E", year: 2020, km: 1000, price: 100000, fuel: "Benzin", transmission: "Manuel", bodyType: "Sedan", equipment: ["ABS"],
    vehicleClass: "Otomobil", vehicleType: "TEST", legalPlate: `00 TST1 ${RUN}`, legalVin: "TST124", damageRecord: "NONE", legalLien: "NONE", warrantyStatus: "NONE", legalRegisteredToCompany: "true",
  },
});
const otherId = race.data?.id;
if (otherId) {
  await uploadFile(Y, admin.cookie, otherId, "photo", "tests/fixtures/car.jpg", "esz.jpg", "image/jpeg");
  await Y(`/api/crm/vehicles/${otherId}/parts`, { method: "PUT", json: { updates: PARTS.map((p) => ({ part: p, state: "ORIGINAL" })) } });
  const racePub = await Y(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "publish" } });
  check("Eşzamanlılık testi için test aracı yayımlandı", racePub.status === 200, JSON.stringify(racePub.data));
}
if (otherId) {
  const [r1, r2] = await Promise.all([
    A(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "option" } }),
    M(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "option" } }),
  ]);
  const okCount = [r1, r2].filter((r) => r.status === 200).length;
  check("Eşzamanlı iki opsiyon isteğinden yalnızca biri başarılı", okCount === 1, `${r1.status}/${r2.status}`);
  await Y(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "releaseOption" } });

  // Eşzamanlı satış: Ahmet opsiyonlar; Ahmet ve yönetici aynı anda satış başlatır → yalnızca biri
  await A(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "option" } });
  const [s1, s2] = await Promise.all([
    A(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "startSale" } }),
    Y(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "startSale" } }),
  ]);
  check("Eşzamanlı iki satış başlatma isteğinden yalnızca biri başarılı", [s1, s2].filter((r) => r.status === 200).length === 1, `${s1.status}/${s2.status}`);
  await Y(`/api/crm/vehicles/${otherId}/transition`, { method: "POST", json: { action: "cancelSale" } });
}

// Faz 1: otomatik taslak, aynı plaka, ticari kasa, tek kontrol ekranı (test kendi araçlarını oluşturur; plakalar her çalıştırmada farklı)
{
  const key = crypto.randomUUID();
  const draftBody = { brand: "Volkswagen", model: "Taslak E2E", createKey: key };
  const [d1, d2] = await Promise.all([A("/api/crm/vehicles", { method: "POST", json: draftBody }), A("/api/crm/vehicles", { method: "POST", json: draftBody })]);
  const did = d1.data?.id;
  check("Otomatik taslak: aynı giriş iki kez gönderilse de tek taslak oluşur", [200, 201].includes(d1.status) && [200, 201].includes(d2.status) && did && did === d2.data?.id, `${d1.status}/${d2.status} ${d1.data?.id} ${d2.data?.id}`);
  const again = await A("/api/crm/vehicles", { method: "POST", json: { createKey: key } });
  check("Otomatik taslak: sayfa yenilenip tekrar gönderilse de aynı taslak döner", again.status === 200 && again.data.id === did && again.data.existing === true, JSON.stringify(again.data));
  const other = await M("/api/crm/vehicles", { method: "POST", json: { createKey: key } });
  check("Otomatik taslak: başka çalışan aynı anahtarla bu taslağa erişemez (409)", other.status === 409, other.status);

  // Bölüm bölüm kısmi kayıt: gönderilmeyen alanlar silinmez
  const p1 = await A(`/api/crm/vehicles/${did}`, { method: "PATCH", json: { price: 1_250_000 } });
  const p2 = await A(`/api/crm/vehicles/${did}`, { method: "PATCH", json: { damageRecord: "NONE", bodyType: "Panelvan", vehicleClass: "Kamyonet", vehicleType: "LT35 P.VAN E2E" } });
  const wiz1 = await A(`/crm/vehicles/${did}/tamamla?adim=1`);
  check("Taslak: bölümler arası kısmi kayıtta önceki bilgiler korunur", p1.status === 200 && p2.status === 200 && wiz1.data.includes("Volkswagen") && wiz1.data.includes("Taslak E2E") && wiz1.data.includes("1.250.000"), `${p1.status}/${p2.status}`);
  check("Ticari araç: Panelvan kasa tipi kabul edilir", p2.status === 200 && wiz1.data.includes("Panelvan"), JSON.stringify(p2.data));

  // Ortak taslak ve eşzamanlı düzenleme: Mehmet, Ahmet'in taslağına devam edebilir; eski sürümle kaydederse Ahmet'in yeni değişikliği ezilmez
  const ver0 = p2.data?.version;
  const a3 = await A(`/api/crm/vehicles/${did}`, { method: "PATCH", json: { km: 250000, baseVersion: ver0 } });
  const mStale = await M(`/api/crm/vehicles/${did}`, { method: "PATCH", json: { km: 1, baseVersion: ver0 } });
  check("Eşzamanlı düzenleme: başka çalışanın daha yeni kaydı sessizce ezilmez (409 + kim değiştirdi)", ver0 && a3.status === 200 && mStale.status === 409 && mStale.data.code === "STALE" && /Ahmet/i.test(mStale.data.error), `${a3.status}/${mStale.status} ${JSON.stringify(mStale.data)}`);
  const mOver = await M(`/api/crm/vehicles/${did}`, { method: "PATCH", json: { km: 260000, baseVersion: ver0, overwrite: true } });
  const mNext = await M(`/api/crm/vehicles/${did}`, { method: "PATCH", json: { km: 255000, baseVersion: mOver.data?.version } });
  check("Ortak taslak: başka çalışan güncel sürümle taslağa devam edebilir; açıkça seçerse kendi değeri kaydedilir", mOver.status === 200 && mNext.status === 200, `${mOver.status}/${mNext.status}`);
  const wizM = await M(`/crm/vehicles/${did}/tamamla?adim=1`);
  check("Ortak taslak: başka çalışan taslağın sihirbazını açabilir ve son değeri görür", wizM.status === 200 && wizM.data.includes("255.000"));

  // Taslağa yeniden erişim
  const manual = await A("/crm/vehicles/new/manual");
  check("Taslağa yeniden erişim: elle ekleme ekranında yarım kalan taslaklar listelenir", manual.status === 200 && manual.data.includes("Yarım kalan taslaklarınız") && manual.data.includes(`/crm/vehicles/${did}/tamamla`));

  // Eksik bilgiyle taslak kaydedilir ama yayımlanamaz; son kontrol ekranı eksikleri "Düzelt" ile listeler
  const pubEarly = await A(`/api/crm/vehicles/${did}/transition`, { method: "POST", json: { action: "publish" } });
  check("Eksik bilgili taslak yayımlanamaz (422)", pubEarly.status === 422, JSON.stringify(pubEarly.data));
  const fin = await A(`/crm/vehicles/${did}/tamamla?adim=4`);
  check("Son kontrol: araç özeti, eksikler ve Düzelt bağlantıları ilgili alana götürür",
    fin.status === 200 && fin.data.includes("final-summary") && fin.data.includes("Düzeltilmesi gerekenler") && fin.data.includes("tamamla?adim=1#legalPlate") && fin.data.includes("tamamla?adim=2#kaporta") && fin.data.includes("tamamla?adim=3#fotograflar"));
  check("Son kontrol: yasal maddeler korunuyor (şasi, rehin, garanti eksik görünür)", fin.data.includes("Şasi numarasının son 6 hanesi eksik") && fin.data.includes("Rehin/haciz durumu girilmedi") && fin.data.includes("Garanti durumu girilmedi"));

  // Aynı plaka: kayıt açılmadan önce sorulur; "yine de yeni kayıt" açık onayla olur
  const plate = `00 E2E ${key.replace(/[^0-9]/g, "").slice(0, 4)}`;
  const setPlate = await A(`/api/crm/vehicles/${did}`, { method: "PATCH", json: { legalPlate: plate } });
  const dupNew = await M("/api/crm/vehicles", { method: "POST", json: { brand: "Test", model: "Taslak E2E", legalPlate: plate.replace(/ /g, "").toLowerCase(), createKey: crypto.randomUUID() } });
  check("Aynı plaka: yazım farkı olsa da mevcut kayıt bulunur, yeni kayıt açılmaz (409)", setPlate.status === 200 && dupNew.status === 409 && dupNew.data.code === "DUPLICATE_PLATE" && dupNew.data.duplicates?.some((d) => d.id === did), JSON.stringify(dupNew.data));
  const dupAck = await M("/api/crm/vehicles", { method: "POST", json: { brand: "Test", model: "Taslak E2E", legalPlate: plate, plateDuplicateAck: true, createKey: crypto.randomUUID() } });
  check("Aynı plaka: personel yine de yeni kayıt derse (açık onayla) kayıt açılır", dupAck.status === 201 && dupAck.data.id, JSON.stringify(dupAck.data));
  const third = await M("/api/crm/vehicles", { method: "POST", json: { brand: "Test", model: "Taslak E2E", createKey: crypto.randomUUID() } });
  const dupPatch = third.data?.id ? await M(`/api/crm/vehicles/${third.data.id}`, { method: "PATCH", json: { legalPlate: plate } }) : {};
  check("Aynı plaka: mevcut taslağın plakası stoktaki araçla aynı yapılamaz (409)", dupPatch.status === 409 && dupPatch.data?.code === "DUPLICATE_PLATE", JSON.stringify(dupPatch.data));
}

// Test için girilen işletme bilgileri geri alınır (önceden boştu)
if (companyRestore) {
  const r = await Y("/api/crm/settings", { method: "PUT", json: companyRestore });
  check("Test işletme bilgileri geri alındı", r.status === 200, r.status);
}

console.log(failures === 0 ? "\nTÜM E2E KONTROLLERİ GEÇTİ" : `\n${failures} KONTROL BAŞARISIZ`);
process.exit(failures ? 1 : 0);
