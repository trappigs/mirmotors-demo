import "server-only";
import { z } from "zod";
import { BODY_PART_KEYS, PART_STATES, type BodyPartKey, type PartState } from "../body-parts";
import { mergeReadings, type DocumentRead, type RawRead } from "./document-sanitize";
import { FORM_OPTIONS, type FormRaw } from "./form-sanitize";
import { EQUIPMENT_OPTIONS } from "../constants";

export type { DocumentRead } from "./document-sanitize";

/**
 * Ruhsat ve ekspertiz raporu görsellerinden araç taslağı çıkarır (OpenAI görüntü modeli, Chat Completions + Structured Outputs).
 * - OPENAI_API_KEY yoksa: açıkça işaretli SİMÜLASYON (sabit örnek; belgeleriniz okunmaz).
 * - AI her belgeyi AYRI okur; birleştirme, şasi doğrulaması ve "aynı araç mı" kararı kodda (document-sanitize.ts).
 * - Görseller personel tarafından maskelenmiş olarak gelir; AI'a ayrıca kişisel veriyi okumaması söylenir.
 */
export const DOC_MODEL = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5.5";
/** Resmî fiyat sayfası (Ekim 2026): gpt-5.5 → 1M token giriş $5, çıktı $30. Model değişirse ortam değişkeniyle güncellenir. */
const PRICE_IN = Number(process.env.OPENAI_PRICE_INPUT_PER_M ?? 5);
const PRICE_OUT = Number(process.env.OPENAI_PRICE_OUTPUT_PER_M ?? 30);
export const MAX_COMPLETION_TOKENS = 20_000;
export const CALL_TIMEOUT_MS = 150_000;

export function documentAiStatus() {
  return { live: Boolean(process.env.OPENAI_API_KEY?.trim()), model: DOC_MODEL };
}

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };
export type ReadOutput = { read: DocumentRead; usage: Usage };

const nStr = z.string().nullable();
const nInt = z.number().int().nullable();
const nNum = z.number().nullable();
const partState = z.enum(PART_STATES);
const docKind = z.enum(["RUHSAT", "EKSPERTIZ", "FORM"]);
/** Kontrol formunun el yazısı alanları (metin olarak alınır; sayı/tarih doğrulaması form-sanitize.ts'de). */
const FORM_TEXT = ["brand", "model", "packageName", "vehicleClass", "vehicleType", "year", "km", "price", "color", "plate", "vinLast6", "engineCc",
  "enginePowerHp", "stockCode", "damageNote", "tramerAmount", "warrantyUntil", "warrantyKm", "otherEquipment", "edevletUntil", "notes"] as const;
/** Kontrol formunun kutu grupları: işaretli seçeneklerin listesi (birden fazla işaret varsa hepsi yazılır, kod karar verir). */
const FORM_CHECKS: [string, readonly string[]][] = [
  ["fuel", FORM_OPTIONS.fuel], ["transmission", FORM_OPTIONS.transmission], ["bodyType", FORM_OPTIONS.bodyType], ["drivetrain", FORM_OPTIONS.drivetrain],
  ["damageRecord", FORM_OPTIONS.damageRecord], ["lien", FORM_OPTIONS.lien], ["warranty", FORM_OPTIONS.warranty], ["expertiseReport", FORM_OPTIONS.expertiseReport],
  ["authority", FORM_OPTIONS.authority], ["edevlet", FORM_OPTIONS.edevlet], ["equipment", EQUIPMENT_OPTIONS],
];
const SLOTS = ["FRONT_END", "FENDER_FRONT", "DOOR_FRONT", "DOOR_REAR", "FENDER_REAR", "REAR_END", "HOOD", "ROOF", "TRUNK", "SILL", "UNSURE"] as const;
const rawSchema = z.object({
  ruhsat: z.object({
    brand: nStr, model: nStr, packageName: nStr, vehicleType: nStr.optional(), tradeName: nStr.optional(), inspectionUntil: nStr.optional(), year: nInt, firstRegistrationDate: nStr, vehicleClass: nStr, color: nStr,
    engineCc: nInt, enginePowerKw: nNum, enginePowerHp: nInt, fuelText: nStr, seats: nInt, plate: nStr, vin: nStr, vinLabel: nStr,
    vinLast6Visible: nStr, ownerType: z.enum(["COMPANY", "PERSON", "UNKNOWN"]),
  }).nullable(),
  ekspertiz: z.object({
    brand: nStr, model: nStr, year: nInt, plate: nStr, vin: nStr, vinLabel: nStr, vinLast6Visible: nStr, km: nInt, fuelText: nStr,
    transmissionText: nStr, reportDate: nStr, company: nStr, legend: z.array(z.object({ text: z.string(), state: partState })),
    parts: z.object(Object.fromEntries(BODY_PART_KEYS.map((k) => [k, partState])) as Record<BodyPartKey, typeof partState>),
    damageNote: nStr, engineFindings: nStr, mechanicalNotes: nStr, electricalNotes: nStr, tramerAmountTl: nInt,
    importantWarnings: z.array(z.string()),
    diagram: z.object({
      views: z.array(z.object({ id: z.string(), kind: z.enum(["SIDE", "TOP"]), frontAt: z.enum(["LEFT", "RIGHT", "UNKNOWN"]), upsideDown: z.boolean() })),
      labels: z.array(z.object({ viewId: z.string(), slot: z.enum(SLOTS), order: z.number().int(), text: z.string(), state: partState })),
    }).nullable(),
  }).nullable(),
  form: z.object({
    pages: z.array(z.object({ image: z.number().int(), formPage: z.union([z.literal(1), z.literal(2)]).nullable() })),
    ...Object.fromEntries(FORM_TEXT.map((k) => [k, nStr])),
    ...Object.fromEntries(FORM_CHECKS.map(([k]) => [k, z.array(z.string())])),
    parts: z.object(Object.fromEntries(BODY_PART_KEYS.map((k) => [k, z.array(z.string())])) as Record<BodyPartKey, z.ZodArray<z.ZodString>>),
    unclear: z.array(z.object({ field: z.string(), reason: z.string() })),
  }).nullable().optional(),
  sources: z.array(z.object({ field: z.string(), document: docKind, page: nInt, location: nStr, text: z.string() })),
  unreadable: z.array(z.object({ field: z.string(), document: docKind, reason: z.string() })),
  quality: z.array(z.object({ document: docKind, page: z.number().int(), issues: z.array(z.enum(["BLURRY", "DARK", "CROPPED", "GLARE", "LOW_RES"])) })),
  warnings: z.array(z.string()),
});

const S = { type: ["string", "null"] };
const I = { type: ["integer", "null"] };
const NUM = { type: ["number", "null"] };
const STR = { type: "string" };
const obj = (properties: Record<string, unknown>, nullable = false) => ({
  type: nullable ? ["object", "null"] : "object", additionalProperties: false, properties, required: Object.keys(properties),
});
const arr = (items: unknown) => ({ type: "array", items });
const PART = { type: "string", enum: [...PART_STATES] };
const DOC = { type: "string", enum: ["RUHSAT", "EKSPERTIZ", "FORM"] };
const FORM_PART = arr({ type: "string", enum: [...FORM_OPTIONS.partColumn] });
const JSON_SCHEMA = obj({
  ruhsat: obj({
    brand: S, model: S, packageName: S, vehicleType: S, tradeName: S, inspectionUntil: S, year: I, firstRegistrationDate: S, vehicleClass: S, color: S, engineCc: I, enginePowerKw: NUM,
    enginePowerHp: I, fuelText: S, seats: I, plate: S, vin: S, vinLabel: S, vinLast6Visible: S,
    ownerType: { type: "string", enum: ["COMPANY", "PERSON", "UNKNOWN"] },
  }, true),
  ekspertiz: obj({
    brand: S, model: S, year: I, plate: S, vin: S, vinLabel: S, vinLast6Visible: S, km: I, fuelText: S, transmissionText: S, reportDate: S,
    company: S, legend: arr(obj({ text: STR, state: PART })), parts: obj(Object.fromEntries(BODY_PART_KEYS.map((k) => [k, PART]))),
    damageNote: S, engineFindings: S, mechanicalNotes: S, electricalNotes: S, tramerAmountTl: I, importantWarnings: arr(STR),
    diagram: obj({
      views: arr(obj({ id: STR, kind: { type: "string", enum: ["SIDE", "TOP"] }, frontAt: { type: "string", enum: ["LEFT", "RIGHT", "UNKNOWN"] }, upsideDown: { type: "boolean" } })),
      labels: arr(obj({ viewId: STR, slot: { type: "string", enum: [...SLOTS] }, order: { type: "integer" }, text: STR, state: PART })),
    }, true),
  }, true),
  form: obj({
    pages: arr(obj({ image: { type: "integer" }, formPage: { type: ["integer", "null"], enum: [1, 2, null] } })),
    ...Object.fromEntries(FORM_TEXT.map((k) => [k, S])),
    ...Object.fromEntries(FORM_CHECKS.map(([k, opts]) => [k, arr({ type: "string", enum: [...opts] })])),
    parts: obj(Object.fromEntries(BODY_PART_KEYS.map((k) => [k, FORM_PART]))),
    unclear: arr(obj({ field: STR, reason: STR })),
  }, true),
  sources: arr(obj({ field: STR, document: DOC, page: I, location: S, text: STR })),
  unreadable: arr(obj({ field: STR, document: DOC, reason: STR })),
  quality: arr(obj({ document: DOC, page: { type: "integer" }, issues: arr({ type: "string", enum: ["BLURRY", "DARK", "CROPPED", "GLARE", "LOW_RES"] }) })),
  warnings: arr(STR),
});

const SYSTEM = `Sen bir otomobil galerisinin belge okuma asistanısın. Sana Türk araç ruhsatı ve/veya oto ekspertiz raporu görselleri verilir
(her görselin önünde türü ve sayfa numarası yazar). Görsellerin bazı bölgeleri personel tarafından kişisel veri nedeniyle siyahla kapatılmış olabilir.
Her belgeyi AYRI oku ve yalnızca o belgede yazanı ilgili nesneye yaz. Belge türü yüklenmediyse nesne null (bunun için uyarı yazma). Belgeler arasında bilgi tamamlama.

KİŞİSEL VERİ: Ad, soyad, T.C. kimlik no, vergi no, adres, telefon, e-posta, imza hiçbir alana ve alıntıya yazılmaz.
ownerType: ruhsat sahibi bölümünde ticari unvan ibaresi (LTD., ŞTİ., A.Ş., OTOMOTİV, TİCARET, SANAYİ vb.) açıkça görülüyorsa COMPANY,
ad-soyad biçimindeyse PERSON, kapatılmış/okunamıyor/emin değilsen UNKNOWN. Adı yazma.

DOĞRULUK: Rakam ve harfleri karakter karakter oku. Okunamayan veya emin olmadığın alanı null yap ve unreadable listesine nedeniyle ekle
(ör. "bulanık", "kapatılmış", "belgede yok", "kesilmiş"). Asla tahmin etme. Fiyat, donanım, kasa tipi yoktur. Ruhsatta vites ve km yoktur: null.

ŞASİ (çok önemli): vin yalnızca "(E) ŞASE NO" (ruhsat) veya ekspertizdeki "Şasi Numarası" alanından okunur. vinLabel'e değerin hemen yanındaki/üstündeki
etiketi aynen yaz (ör. "(E) ŞASE NO"). Motor no (P.5), belge seri no, tescil sıra no, onay no ASLA şasi değildir. Tam numara okunamıyor ama son 6 karakteri
net görünüyorsa vin null, vinLast6Visible = son 6 karakter. Hiçbiri okunamıyorsa ikisi de null.

RUHSAT: brand (D.1), model ve packageName (D.2 Tipi / D.3 Ticari adı; model = ana model ör. "Palio", packageName = kalan ör. "Sole 1.4 Fire Dynamic"),
vehicleType (D.2 Tipi alanında yazan, olduğu gibi; okunamıyorsa null), tradeName (D.3 Ticari adı alanında yazan, olduğu gibi; kod gibi görünse de değiştirme),
model/packageName ilan için anlaşılır addır: D.3 anlamlıysa ondan, kod ise D.2'den çıkar (ör. D.2 "LT35 P.VAN H/R LWB 2.5 TDI 109" → model "LT 35", packageName "2.5 TDI");
emin olmadığın donanım/paket uydurma. inspectionUntil: Z.2 Diğer bilgiler'de muayene geçerlilik tarihi açıkça yazıyorsa GG/AA/YYYY, yoksa null.
Ruhsatın üzerine sonradan elle yazılmış rakam ve notlar (ör. km, fiyat) ruhsat bilgisi değildir: hiçbir alana yazma. year (D.4), firstRegistrationDate (B, GG/AA/YYYY), vehicleClass (D.5 Cinsi), color (R), engineCc (P.1), enginePowerKw (P.2 kW ise) / enginePowerHp (HP ise),
fuelText (P.3, olduğu gibi), seats (S.1), plate (A).
EKSPERTİZ (çok sayfalı olabilir; tüm sayfaları birlikte değerlendir): brand, model, year, plate, vin, km (nokta binlik ayraçtır), fuelText, transmissionText,
reportDate (YYYY-AA-GG), company (ekspertiz firması), damageNote, engineFindings (motor testi/bulguları), mechanicalNotes, electricalNotes,
tramerAmountTl (YALNIZCA raporda açıkça tramer tutarı yazıyorsa; yazmıyorsa null — bu "tramer yok" demek değildir), importantWarnings.
LEJANT: raporun renk/simge açıklamalarını legend'a yaz (ör. {text:"Turuncu = Lokal boya", state:"LOCAL_PAINT"}). Bir simgenin anlamı raporda yazmıyorsa o simgeyi
parçalara dönüştürme. PARÇALAR: ORIGINAL, LOCAL_PAINT, PAINTED, CHANGED yalnızca raporda açıkça belirtilmişse; "Plastik", belirtilmemiş, okunamayan veya
sağ/sol tarafından emin olunmayan parça UNKNOWN. Hiçbir parçayı varsayımla ORIGINAL yapma.
KAPORTA ŞEMASI (araç çizimleri üzerinde durum yazan kutular varsa diagram'ı DOLDUR; sağ/sol kararını SEN VERME, kod verir):
- views: şemadaki her araç çizimi için bir kayıt; id yukarıdan aşağı "V1", "V2", "V3". kind: yandan görünüş SIDE, üstten (tavan görünen) TOP.
  frontAt: aracın ÖNÜ (farlar, ön tampon, motor kaputu, ön cam tarafı) çizimin solunda mı sağında mı; emin değilsen UNKNOWN.
  upsideDown: yan görünüşte tekerlekler gövdenin ÜSTÜNDE çizilmişse (ters çizim) true, normalde false. Üstten görünüşte false.
- labels: şemadaki HER durum kutusu için bir kayıt. viewId: kutunun ait olduğu çizim. text: kutuda yazan (ör. "ORJİNAL", "BOYALI", "PLASTİK").
  state: kutunun anlamı (Orijinal/Orjinal → ORIGINAL, Lokal boya → LOCAL_PAINT, Boyalı → PAINTED, Değişen → CHANGED, Plastik/okunamayan → UNKNOWN).
  slot: kutunun aracın neresinde durduğu — yan görünüşte önden arkaya: FRONT_END (ön tampon ucu), FENDER_FRONT (ön tekerlek üstü, ön çamurluk),
  DOOR_FRONT (ön kapı), DOOR_REAR (arka kapı), FENDER_REAR (arka tekerlek üstü, arka çamurluk), REAR_END (arka tampon ucu); kapıların altında/üstünde
  gövde boyunca uzanan alt kutu SILL (marşpiyel). Üstten görünüşte: önde HOOD, ortada ROOF, arkada TRUNK. Emin değilsen UNSURE.
  order: yan görünüşte gövde hizasındaki (kapı/çamurluk sırasındaki) kutuların aracın ÖNÜNDEN başlayarak sırası 1, 2, 3, 4…; marşpiyel kutusu ve
  üstten görünüş için 0. Tekerlek üstündeki kutu çamurluktur (tampon değildir). Yaygın şablonda yan görünüşte tampon kutusu yoktur.
  Yaygın şablonda (ör. "KAPORTA VE BOYA EKSPERTİZ SONUÇLARI") üstte ters çizilmiş yan görünüş, ortada üstten görünüş, altta düz yan görünüş bulunur.
- Şema yoksa (yalnızca tablo/liste) diagram null; parçaları tablodaki adlarına göre parts'a yaz. Şema varsa parts'ı yine doldur ama esas olan diagram'dır.
KONTROL FORMU ("MİR MOTORS ARAÇ KONTROL FORMU" başlıklı görseller; galerinin kendi 2 sayfalık "Araç Kontrol ve İlan Bilgi Formu"; resmî ekspertiz değildir):
- pages: form olarak verilen HER görsel için {image: başlıktaki görsel sırası, formPage}. 1. sayfa: "1 · Temel bilgiler", "2 · Kaporta / boya durumu",
  "3 · Hasar ve yasal bilgiler". 2. sayfa: "Donanım, satış yetkisi ve onay", "4 · Donanım". Sırayı içerikten belirle (ters yüklenmiş olabilir); tanıyamazsan null.
- El yazısı alanları (brand, model, packageName, vehicleClass, vehicleType, year, km, price, color, plate, vinLast6, engineCc, enginePowerHp, stockCode,
  damageNote, tramerAmount, warrantyUntil, warrantyKm, otherEquipment, edevletUntil, notes): kutuda YAZANI karakter karakter olduğu gibi yaz; sayıyı
  düzeltme, birim ekleme, tahmin etme. Boşsa null. Okuyamadığın veya emin olmadığın alanı null yap ve unclear'a {field, reason} ekle.
- Kutu grupları (fuel, transmission, bodyType, drivetrain, damageRecord, lien, warranty, expertiseReport, authority, edevlet, equipment): yalnızca açıkça
  İŞARETLİ (✓, X, dolu) kutuların seçeneklerini yaz. Birden fazla kutu işaretliyse HEPSİNİ yaz; tek seçeneğe indirme. Hiç işaret yoksa boş liste.
  Silik / karalanmış / emin olmadığın işareti yazma, unclear'a ekle (field: grup adı). Eşleme: Hasar kaydı Yok=NONE, Var=MINOR, Ağır hasar kayıtlı=HEAVY;
  Rehin/haciz Yok=NONE, Var=EXISTS; Garanti Devam ediyor=ACTIVE, Yok=NONE (eski formlardaki "Devam etmiyor"=NONE). Eski formlarda bulunan
  "Sorgulanmadı", "Doğrulanamadı", "Doğrulanmadı", "Bilinmiyor" kutuları için seçenek yazma; işaretliyse unclear'a ekle. Resmî ekspertiz raporu Var=VAR, Yok=YOK; Satış yetkisi "Araç Mir Motors adına tescilli"=COMPANY,
  "Araç sahibinden satış / ilan izni alındı"=OWNER_CONSENT; e-Devlet ilan yetkisi "Gerekmiyor"=NOT_NEEDED, "Verildi"=GRANTED, "Henüz verilmedi"=NOT_YET.
  equipment: 2. sayfadaki işaretli donanımların adları (listedeki yazımla); "Diğer donanım" satırındaki yazı otherEquipment'a.
- parts: 13 satırlık kaporta tablosu. Her satır (Kaput=HOOD, Tavan=ROOF, Bagaj=TRUNK, Ön tampon=FRONT_BUMPER, Arka tampon=REAR_BUMPER, Sol ön çamurluk=LEFT_FRONT_FENDER,
  Sağ ön çamurluk=RIGHT_FRONT_FENDER, Sol ön kapı=LEFT_FRONT_DOOR, Sağ ön kapı=RIGHT_FRONT_DOOR, Sol arka kapı=LEFT_REAR_DOOR, Sağ arka kapı=RIGHT_REAR_DOOR,
  Sol arka çamurluk=LEFT_REAR_FENDER, Sağ arka çamurluk=RIGHT_REAR_FENDER) için o satırda işaretli sütunlar: Orijinal=ORIGINAL, Lokal boyalı=LOCAL_PAINT,
  Boyalı=PAINTED, Değişen=CHANGED, Kontrol edilemedi=NOT_CHECKED. Satırı tablodaki YAZILI parça adına göre eşle (sol/sağ yazıdan okunur, şemadan değil).
  İşaretsiz satır boş liste; iki işaret varsa ikisini de yaz. Boş satırı ORIGINAL yapma.
- Onay bölümündeki ad-soyad ve imzaları hiçbir alana yazma (maskelenmiş olabilir).
SOURCES: her dolu alan için field, belge, sayfa numarası, location (ör. "sol üst", "kaporta şeması üst görünüş") ve kısa metin. Kişisel veri yazma.
QUALITY: her görsel için bulanık (BLURRY), karanlık (DARK), kenarı kesilmiş (CROPPED), parlama (GLARE), düşük çözünürlük (LOW_RES) sorunlarını yaz.`;

export type DocImage = { kind: "RUHSAT" | "EKSPERTIZ" | "FORM"; page: number; data: Buffer };
const IMAGE_TITLE = { RUHSAT: "ARAÇ RUHSATI", EKSPERTIZ: "OTO EKSPERTİZ RAPORU", FORM: "MİR MOTORS ARAÇ KONTROL FORMU" } as const;

/** Görselleri OpenAI'a gönderir; ham okumayı kodda birleştirir. Kullanım ve tahmini maliyet döner. */
export async function readDocuments(images: DocImage[]): Promise<ReadOutput> {
  const content: unknown[] = [];
  for (const img of images) {
    const mime = img.data[0] === 0xff && img.data[1] === 0xd8 ? "image/jpeg" : img.data.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp" : "image/png";
    // Form görsellerinde "görsel" sırası yükleme sırasıdır; formun hangi sayfası olduğunu AI içerikten söyler (pages.formPage).
    content.push({ type: "text", text: img.kind === "FORM" ? `${IMAGE_TITLE.FORM} — görsel ${img.page}` : `${IMAGE_TITLE[img.kind]} — sayfa ${img.page}` });
    content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${img.data.toString("base64")}`, detail: "high" } });
  }
  content.push({ type: "text", text: "Belgeleri kurallara göre ayrı ayrı oku." });

  const reasoning = /^(gpt-5|o\d)/.test(DOC_MODEL);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DOC_MODEL,
      ...(reasoning ? { reasoning_effort: process.env.OPENAI_REASONING_EFFORT?.trim() || "medium" } : { temperature: 0 }),
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content }],
      response_format: { type: "json_schema", json_schema: { name: "arac_belgeleri", strict: true, schema: JSON_SCHEMA } },
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: string };
    choices?: { message?: { content?: string; refusal?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (!res.ok) {
    if (res.status === 401) throw new DocReadError("OpenAI API anahtarı geçersiz (401).", false);
    if (res.status === 429) throw new DocReadError("OpenAI kotası veya hız sınırı aşıldı (429).", true);
    throw new DocReadError(`Belge okuma servisi hata verdi (${data.error?.code ?? res.status}).`, res.status >= 500);
  }
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const usage = { inputTokens, outputTokens, costUsd: (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000 };
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new DocReadError("AI belgeyi okumayı reddetti; bilgileri elle girin.", false, usage);
  if (choice?.finish_reason === "length") throw new DocReadError("AI yanıtı uzunluk sınırına takıldı; daha az sayfa ile deneyin.", false, usage);
  const parsed = rawSchema.safeParse(JSON.parse(choice?.message?.content ?? "null"));
  if (!parsed.success) throw new DocReadError("AI çıktısı beklenen biçimde değil.", true, usage);
  if (!parsed.data.ruhsat && !parsed.data.ekspertiz && !parsed.data.form) parsed.data.warnings.push("Yüklenen görsellerde ruhsat, ekspertiz raporu veya kontrol formu tanınamadı.");
  // Yalnızca yüklenen türlerin sonucu kullanılır (AI yüklenmeyen bir belge türünü "okumuş" gibi doldurursa yok sayılır)
  const kinds = new Set(images.map((i) => i.kind));
  // AI'nın "şu belge yüklenmediği için null bırakıldı" türü gereksiz uyarıları gösterilmez
  parsed.data.warnings = parsed.data.warnings.filter((w) => !/yüklenmedi|null bırak/i.test(w));
  const raw = { ...parsed.data, ruhsat: kinds.has("RUHSAT") ? parsed.data.ruhsat : null, ekspertiz: kinds.has("EKSPERTIZ") ? parsed.data.ekspertiz : null, form: kinds.has("FORM") ? (parsed.data.form as FormRaw | null | undefined) ?? null : null };
  return { read: mergeReadings(raw as RawRead), usage };
}

/** Yeniden denenebilir (geçici) ve denenemez hataları ayırır; kullanım kaydı korunur. */
export class DocReadError extends Error {
  constructor(message: string, public retryable: boolean, public usage?: Usage) {
    super(message);
  }
}

/** SİMÜLASYON: gerçek okuma DEĞİLDİR. Yüklenen belgeler okunmaz; akışı göstermek için yöntemle uyumlu sabit örnek. */
export function documentSimulation(kinds: ("RUHSAT" | "EKSPERTIZ" | "FORM")[], formPages = 2): DocumentRead {
  const hasR = kinds.includes("RUHSAT"), hasE = kinds.includes("EKSPERTIZ"), hasF = kinds.includes("FORM");
  const parts = Object.fromEntries(BODY_PART_KEYS.map((k) => [k, "UNKNOWN"])) as Record<BodyPartKey, PartState>;
  if (hasE) Object.assign(parts, { HOOD: "ORIGINAL", ROOF: "ORIGINAL", TRUNK: "LOCAL_PAINT", RIGHT_REAR_FENDER: "PAINTED", LEFT_FRONT_DOOR: "ORIGINAL" });
  const raw: RawRead = {
    ruhsat: hasR
      ? { brand: "FIAT", model: "EGEA", packageName: "1.4 FIRE EASY", vehicleType: null, tradeName: "EGEA 1.4 FIRE EASY", inspectionUntil: null, year: 2019, firstRegistrationDate: "15/05/2019", vehicleClass: "OTOMOBİL", color: "BEYAZ",
          engineCc: 1368, enginePowerKw: 70, enginePowerHp: null, fuelText: "BENZİNLİ", seats: 5, plate: null, vin: null, vinLabel: null, vinLast6Visible: null, ownerType: "UNKNOWN" }
      : null,
    ekspertiz: hasE
      ? { brand: "Fiat", model: "Egea", year: 2019, plate: null, vin: null, vinLabel: null, vinLast6Visible: null, km: 84500, fuelText: "Benzin", transmissionText: "Manuel",
          reportDate: null, company: "Örnek Ekspertiz", legend: [{ text: "Turuncu = Lokal boya (örnek)", state: "LOCAL_PAINT" }], parts,
          damageNote: "Örnek: bagaj kapağında lokal boya.", engineFindings: "Örnek: motor testi olumlu.", mechanicalNotes: null, electricalNotes: null,
          tramerAmountTl: null, importantWarnings: [] }
      : null,
    form: hasF ? simulatedForm(formPages) : null,
    sources: [
      ...(hasR ? [{ field: "brand", document: "RUHSAT" as const, page: 1, location: "sol (D.1)", text: "(D.1) MARKASI: FIAT (örnek)" }] : []),
      ...(hasF ? [{ field: "price", document: "FORM" as const, page: 1, location: "1 · Temel bilgiler", text: "Satış fiyatı: 985.000 (örnek)" }] : []),
      ...(hasE ? [{ field: "km", document: "EKSPERTIZ" as const, page: 1, location: "üst tablo", text: "Kilometre: 84.500 (örnek)" }] : []),
    ],
    unreadable: hasR ? [{ field: "plate", document: "RUHSAT", reason: "simülasyon: örnek veride plaka yok" }] : [],
    quality: [],
    warnings: ["SİMÜLASYON: Bu bilgiler yüklediğiniz belgelerden okunmadı."],
  };
  return mergeReadings(raw);
}

/** Simülasyon için sentetik kontrol formu (gerçek araç değildir; plaka/şasi yazılmaz). Bagaj "orijinal" → örnek ekspertizle çelişki gösterir. */
function simulatedForm(pages: number): FormRaw {
  const none = Object.fromEntries(BODY_PART_KEYS.map((k) => [k, ["ORIGINAL"]])) as Record<BodyPartKey, string[]>;
  return {
    pages: pages >= 2 ? [{ image: 1, formPage: 1 }, { image: 2, formPage: 2 }] : [{ image: 1, formPage: 1 }],
    brand: "Fiat", model: "Egea", packageName: "1.4 Fire Easy", vehicleClass: "Otomobil", vehicleType: null, year: "2019", km: "84.500", price: "985.000",
    color: "Beyaz", plate: null, vinLast6: null, engineCc: "1368", enginePowerHp: "95", stockCode: null,
    fuel: ["Benzin"], transmission: ["Manuel"], bodyType: ["Sedan"], drivetrain: ["Önden çekiş"],
    parts: { ...none, RIGHT_REAR_FENDER: ["PAINTED"], LEFT_FRONT_DOOR: ["LOCAL_PAINT"] },
    damageRecord: ["MINOR"], damageNote: "Örnek: sağ arka çamurlukta boya (simülasyon).", tramerAmount: "12.400",
    lien: ["NONE"], warranty: ["NONE"], warrantyUntil: null, warrantyKm: null, expertiseReport: ["YOK"],
    equipment: pages >= 2 ? ["ABS", "ESP", "Klima", "Bluetooth", "Geri görüş kamerası"] : [], otherEquipment: null,
    authority: pages >= 2 ? ["COMPANY"] : [], edevlet: pages >= 2 ? ["NOT_NEEDED"] : [], edevletUntil: null, notes: null,
    unclear: [],
  };
}
