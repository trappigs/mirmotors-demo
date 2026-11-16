import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { summarizeEvent, verifyChallenge, verifySignature } from "@/lib/whatsapp-webhook";

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
