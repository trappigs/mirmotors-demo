import { describe, expect, it } from "vitest";
import { maskApplyBlock, maskConfirmation, type MaskState } from "@/lib/mask-rules";

const s = (o: Partial<MaskState>): MaskState => ({ kind: "FORM", rectCount: 0, hasCurtain: false, confirmed: false, ...o });

describe("maskeleme kuralları", () => {
  it("tür seçilmeden uygulanamaz", () => {
    expect(maskApplyBlock(s({ kind: null, rectCount: 2 }))).toMatch(/belge/);
  });

  it("ruhsatta perde yoksa onay ister (kutu çizilmiş olsa bile)", () => {
    expect(maskConfirmation(s({ kind: "RUHSAT" }))).toMatch(/sol sayfası/);
    expect(maskApplyBlock(s({ kind: "RUHSAT" }))).toMatch(/Sağ tarafı/);
    expect(maskApplyBlock(s({ kind: "RUHSAT", rectCount: 3 }))).toMatch(/Sağ tarafı/);
  });

  it("ruhsatta onay verilince ya da perde kullanılınca uygulanır", () => {
    expect(maskApplyBlock(s({ kind: "RUHSAT", confirmed: true }))).toBeNull();
    expect(maskConfirmation(s({ kind: "RUHSAT", hasCurtain: true }))).toBeNull();
    expect(maskApplyBlock(s({ kind: "RUHSAT", hasCurtain: true }))).toBeNull();
  });

  it("formda hiçbir şey kapatılmadıysa onay ister", () => {
    expect(maskConfirmation(s({}))).toMatch(/kontrol ettim/);
    expect(maskApplyBlock(s({}))).toMatch(/onaylayın/);
    expect(maskApplyBlock(s({ confirmed: true }))).toBeNull();
  });

  it("formda en az bir alan kapatıldıysa onay gerekmez", () => {
    expect(maskConfirmation(s({ rectCount: 1 }))).toBeNull();
    expect(maskApplyBlock(s({ rectCount: 1 }))).toBeNull();
    expect(maskApplyBlock(s({ hasCurtain: true }))).toBeNull();
  });
});
