/** Bağlantı adresi bu bilgisayardaki bir veritabanını mı gösteriyor? (sıfırlama korumaları için) */
export function isLocalDatabaseUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return ["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    return false;
  }
}
