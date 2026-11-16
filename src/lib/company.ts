import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { envCompanyInfo, type CompanyInfo } from "./listing-rules";

/** İşletme bilgileri: CRM > Ayarlar'daki kayıt; boş alanlar ortam değişkeninden tamamlanır. */
export const getCompanyInfo = cache(async (): Promise<CompanyInfo> => {
  const env = envCompanyInfo();
  const row = await prisma.companySettings.findUnique({ where: { id: "default" } }).catch(() => null);
  return {
    title: row?.title || env.title,
    authorizationNo: row?.authorizationNo || env.authorizationNo,
    mersis: row?.mersis || env.mersis,
    address: row?.address || env.address,
  };
});
