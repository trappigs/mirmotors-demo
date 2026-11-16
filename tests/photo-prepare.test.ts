import { describe, expect, it } from "vitest";
import {
  PHOTO_MAX_COUNT,
  PREP_MAX_EDGE,
  PREP_REENCODE_BYTES,
  dedupeFiles,
  fileKey,
  kindFromBytes,
  kindFromName,
  makeLimiter,
  moveItem,
  nameForKind,
  needsReencode,
  remainingSlots,
  targetSize,
  toJpgName,
} from "@/lib/photo-prepare";

// Yalnızca DOM gerektirmeyen saf yardımcılar test edilir; tarayıcıda dönüştürme (canvas, heic2any) gerçek cihazda denenmelidir.
const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("kindFromName", () => {
  it("MIME türünden tanır", () => {
    expect(kindFromName("a", "image/jpeg")).toBe("jpeg");
    expect(kindFromName("a", "image/png")).toBe("png");
    expect(kindFromName("a", "image/webp")).toBe("webp");
    expect(kindFromName("a", "image/heic")).toBe("heic");
    expect(kindFromName("a", "image/heif")).toBe("heic");
  });
  it("MIME yoksa uzantıdan tanır (büyük/küçük harf duyarsız)", () => {
    expect(kindFromName("IMG_0001.HEIC", "")).toBe("heic");
    expect(kindFromName("foto.heif", "")).toBe("heic");
    expect(kindFromName("foto.JPEG", "")).toBe("jpeg");
    expect(kindFromName("foto.jpg", "")).toBe("jpeg");
    expect(kindFromName("foto.png", "")).toBe("png");
  });
  it("desteklenmeyenleri reddeder", () => {
    expect(kindFromName("belge.pdf", "application/pdf")).toBeNull();
    expect(kindFromName("foto.gif", "image/gif")).toBeNull();
    expect(kindFromName("adsiz", "")).toBeNull();
  });
});

describe("kindFromBytes", () => {
  it("imzalardan tanır", () => {
    expect(kindFromBytes(bytes([0xff, 0xd8, 0xff, 0xe0], [0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpeg");
    expect(kindFromBytes(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 0]))).toBe("png");
    expect(kindFromBytes(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("webp");
    expect(kindFromBytes(bytes([0, 0, 0, 0x18], "ftyp", "heic"))).toBe("heic");
    expect(kindFromBytes(bytes([0, 0, 0, 0x18], "ftyp", "mif1"))).toBe("heic");
  });
  it("video (mp4) ve kısa veriyi fotoğraf saymaz", () => {
    expect(kindFromBytes(bytes([0, 0, 0, 0x18], "ftyp", "isom"))).toBeNull();
    expect(kindFromBytes(bytes("%PDF-1.7", [0, 0, 0, 0]))).toBeNull();
    expect(kindFromBytes(bytes([0xff, 0xd8]))).toBeNull();
  });
});

describe("targetSize", () => {
  it("küçük görseli büyütmez", () => {
    expect(targetSize(1600, 1200)).toEqual({ width: 1600, height: 1200, scaled: false });
    expect(targetSize(PREP_MAX_EDGE, 100)).toEqual({ width: PREP_MAX_EDGE, height: 100, scaled: false });
  });
  it("en uzun kenarı sınıra indirir, oranı korur", () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 2560, height: 1920, scaled: true });
    expect(targetSize(3024, 4032)).toEqual({ width: 1920, height: 2560, scaled: true });
    expect(targetSize(8000, 10, 2000)).toEqual({ width: 2000, height: 3, scaled: true });
  });
  it("sıfır/çok küçük kenarda en az 1 piksel", () => {
    expect(targetSize(100000, 1).height).toBe(1);
    expect(targetSize(0, 0)).toEqual({ width: 1, height: 1, scaled: false });
  });
});

describe("needsReencode", () => {
  it("HEIC her zaman çevrilir", () => {
    expect(needsReencode("heic", 1000, 100, 100)).toBe(true);
  });
  it("küçük ve sınır içindeki fotoğrafa dokunulmaz", () => {
    expect(needsReencode("jpeg", PREP_REENCODE_BYTES, 2560, 1920)).toBe(false);
    expect(needsReencode("png", 500_000, 1200, 800)).toBe(false);
  });
  it("büyük dosya veya büyük çözünürlük çevrilir", () => {
    expect(needsReencode("jpeg", PREP_REENCODE_BYTES + 1, 1000, 1000)).toBe(true);
    expect(needsReencode("webp", 300_000, 4000, 3000)).toBe(true);
  });
});

describe("dosya adları", () => {
  it("toJpgName uzantıyı .jpg yapar", () => {
    expect(toJpgName("IMG_0001.HEIC")).toBe("IMG_0001.jpg");
    expect(toJpgName("araba.on.png")).toBe("araba.on.jpg");
    expect(toJpgName("adsiz")).toBe("adsiz.jpg");
    expect(toJpgName("")).toBe("foto.jpg");
  });
  it("nameForKind içerikle uyumsuz uzantıyı düzeltir", () => {
    expect(nameForKind("a.JPG", "jpeg")).toBe("a.JPG");
    expect(nameForKind("a.jpeg", "jpeg")).toBe("a.jpeg");
    expect(nameForKind("IMG_0001.HEIC", "jpeg")).toBe("IMG_0001.jpg");
    expect(nameForKind("image", "png")).toBe("image.png");
    expect(nameForKind("x.jpg", "webp")).toBe("x.webp");
  });
});

describe("dedupeFiles", () => {
  const f = (name: string, size: number, lastModified = 1) => ({ name, size, lastModified });
  it("aynı seçimdeki birebir tekrarları eler, sırayı korur", () => {
    const list = [f("a.jpg", 10), f("b.jpg", 20), f("a.jpg", 10), f("a.jpg", 11)];
    const r = dedupeFiles(list);
    expect(r.unique.map(fileKey)).toEqual(["a.jpg|10|1", "b.jpg|20|1", "a.jpg|11|1"]);
    expect(r.duplicates).toHaveLength(1);
  });
  it("kuyrukta zaten olanları da eler", () => {
    const r = dedupeFiles([f("a.jpg", 10), f("c.jpg", 5)], ["a.jpg|10|1"]);
    expect(r.unique.map((x) => x.name)).toEqual(["c.jpg"]);
  });
  it("değiştirilme zamanı farklıysa farklı dosyadır", () => {
    expect(dedupeFiles([f("a.jpg", 10, 1), f("a.jpg", 10, 2)]).unique).toHaveLength(2);
  });
});

describe("remainingSlots", () => {
  it("40 sınırını uygular", () => {
    expect(remainingSlots(0, 0)).toBe(PHOTO_MAX_COUNT);
    expect(remainingSlots(38, 1)).toBe(1);
    expect(remainingSlots(40, 0)).toBe(0);
    expect(remainingSlots(39, 5)).toBe(0);
  });
});

describe("moveItem", () => {
  it("öğeyi yeni sırasına taşır", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });
  it("geçersiz indekste değiştirmez, girdiyi bozmaz", () => {
    const src = ["a", "b"];
    expect(moveItem(src, 0, 5)).toEqual(["a", "b"]);
    expect(moveItem(src, 1, 1)).toEqual(["a", "b"]);
    moveItem(src, 0, 1);
    expect(src).toEqual(["a", "b"]);
  });
});

describe("makeLimiter", () => {
  it("aynı anda en fazla n iş çalıştırır ve sırayı korur", async () => {
    const limit = makeLimiter(2);
    let active = 0;
    let peak = 0;
    const started: number[] = [];
    const job = (i: number) =>
      limit(async () => {
        started.push(i);
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return i;
      });
    const results = await Promise.all([0, 1, 2, 3, 4].map(job));
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(started).toEqual([0, 1, 2, 3, 4]);
  });
  it("hata olsa da yeri boşaltır", async () => {
    const limit = makeLimiter(1);
    await expect(limit(async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(limit(async () => 7)).resolves.toBe(7);
  });
});
