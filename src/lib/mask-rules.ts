// Kişisel veri maskeleme ekranının "uygula" kuralları (tarayıcıda çalışır; saf fonksiyon, test edilebilir).
// Amaç: personelin hiçbir şey kapatmadan "geç" demesini zorlaştırmak.
//  - Ruhsat: sağ sayfada sahibin kimlik ve adres bilgileri vardır. Perde (bir tarafı kapatma) kullanılmadıysa personel
//    fotoğrafta sağ sayfanın görünmediğini ayrıca onaylamalıdır.
//  - Her belge: hiçbir alan kapatılmadıysa personel sayfada kişisel veri olmadığını ayrıca onaylamalıdır.

export type MaskKind = "RUHSAT" | "FORM";

export type MaskState = {
  kind: MaskKind | null;
  /** Çizilen kutu sayısı (perde hariç). */
  rectCount: number;
  hasCurtain: boolean;
  /** Personelin işaretlediği onay kutusu. */
  confirmed: boolean;
};

/** Onay kutusu gerekiyorsa metnini döner; gerekmiyorsa null. */
export function maskConfirmation(s: MaskState): string | null {
  if (!s.kind) return null;
  if (s.kind === "RUHSAT" && !s.hasCurtain) {
    return "Fotoğrafta yalnızca ruhsatın sol sayfası var; sağ sayfa (sahibin adı, T.C. no, adresi) görünmüyor ya da üstünü kapattım.";
  }
  if (s.rectCount === 0 && !s.hasCurtain) {
    return "Bu sayfada ad-soyad, T.C. kimlik no, adres, telefon veya imza görünmüyor; kontrol ettim.";
  }
  return null;
}

/** "Uygula" düğmesinin kapalı olma nedeni; açıksa null. */
export function maskApplyBlock(s: MaskState): string | null {
  if (!s.kind) return "Önce bu sayfanın hangi belge olduğunu seçin.";
  if (maskConfirmation(s) && !s.confirmed) {
    return s.kind === "RUHSAT" && !s.hasCurtain
      ? "Sağ sayfayı \"Sağ tarafı\" ile kapatın ya da görünmediğini onaylayın."
      : "Kişisel verileri kapatın ya da sayfada kişisel veri olmadığını onaylayın.";
  }
  return null;
}
