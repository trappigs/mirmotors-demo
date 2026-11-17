import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractMessages, formatWaId, normalizePhone, summarizeEvent, verifyChallenge, verifySignature } from "@/lib/whatsapp-webhook";

const q = (o: Record<string, string>) => new URLSearchParams(o);

describe("whatsapp webhook doğrulaması", () => {
  it("doğru token ile challenge döner", () => {
    expect(verifyChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "123" }), "abc")).toBe("123");
  });

  it("yanlış token, eksik mod ya da tanımsız token reddedilir", () => {
    expect(verifyChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "1" }), "abc")).toBeNull();
    expect(verifyChallenge(q({ "hub.verify_token": "abc", "hub.challenge": "1" }), "abc")).toBeNull();
    expect(verifyChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), undefined)).toBeNull();
  });

  it("imza yalnız doğru secret ve ham gövdeyle geçer", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifySignature(body, sig, "s3cret")).toBe(true);
    expect(verifySignature(body, sig, "baska")).toBe(false);
    expect(verifySignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifySignature(body, null, "s3cret")).toBe(false);
    expect(verifySignature(body, "sha1=abc", "s3cret")).toBe(false);
  });

  it("özet kişisel veri içermez, yalnız sayar", () => {
    const s = summarizeEvent({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "905551112233", text: { body: "merhaba" } }], statuses: [{}, {}] } }] }],
    });
    expect(s).toEqual({ object: "whatsapp_business_account", messages: 1, statuses: 2, fields: ["messages"] });
    expect(JSON.stringify(s)).not.toMatch(/9055|merhaba/);
    expect(summarizeEvent(null)).toEqual({ object: "?", messages: 0, statuses: 0, fields: [] });
  });
});

describe("gelen mesajların çıkarılması", () => {
  const event = (value: unknown, field = "messages") => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field, value }] }] });

  it("metin mesajını ad, numara ve zamanla çıkarır", () => {
    const [m, ...rest] = extractMessages(event({
      metadata: { phone_number_id: "PNID" },
      contacts: [{ wa_id: "905321234567", profile: { name: "Ali Veli" } }],
      messages: [{ id: "wamid.1", from: "905321234567", timestamp: "1763337600", type: "text", text: { body: "Passat duruyor mu?" } }],
    }));
    expect(rest).toEqual([]);
    expect(m).toEqual({ waMessageId: "wamid.1", waId: "905321234567", contactName: "Ali Veli", type: "text", text: "Passat duruyor mu?", sentAt: new Date(1763337600 * 1000), phoneNumberId: "PNID", replyId: null });
  });

  it("medyada açıklamayı alır, açıklama yoksa metin boş kalır; düğme yanıtını alır", () => {
    const ms = extractMessages(event({ messages: [
      { id: "a", from: "905321234567", timestamp: "1", type: "image", image: { id: "m1", caption: "ruhsat" } },
      { id: "b", from: "905321234567", timestamp: "1", type: "audio", audio: { id: "m2" } },
      { id: "c", from: "905321234567", timestamp: "1", type: "interactive", interactive: { button_reply: { title: "Evet" } } },
    ] }));
    expect(ms.map((m) => [m.type, m.text, m.contactName])).toEqual([["image", "ruhsat", null], ["audio", null, null], ["interactive", "Evet", null]]);
  });

  it("durum güncellemelerini, başka alanları ve bozuk kayıtları atlar", () => {
    expect(extractMessages(event({ statuses: [{ id: "s", status: "read" }] }))).toEqual([]);
    expect(extractMessages(event({ messages: [{ id: "x", from: "905321234567", type: "text", text: { body: "a" } }] }, "account_update"))).toEqual([]);
    expect(extractMessages(event({ messages: [{ from: "905321234567" }, { id: "y" }, null] }))).toEqual([]);
    expect(extractMessages(null)).toEqual([]);
  });

  it("çok uzun metni kısaltır", () => {
    const [m] = extractMessages(event({ messages: [{ id: "z", from: "90532", timestamp: "1", type: "text", text: { body: "a".repeat(5000) } }] }));
    expect(m.text).toHaveLength(4000);
  });

  it("numarayı okunur gösterir", () => {
    expect(formatWaId("905321234567")).toBe("+90 532 123 45 67");
    expect(formatWaId("4915112345678")).toBe("+4915112345678");
  });
});

describe("personel telefonu", () => {
  it("farklı yazımları WhatsApp kimliğine çevirir", () => {
    for (const v of ["0532 123 45 67", "+90 532 123 45 67", "532 123 4567", "0090 532 123 45 67", "905321234567"]) expect(normalizePhone(v)).toBe("905321234567");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});
