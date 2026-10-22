import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { isLocalDatabaseUrl } from "../scripts/db-url.mjs";

// Testler ayrı, YEREL bir PostgreSQL veritabanı kullanır (ör. `npx prisma dev --name mirmotors-test`).
// Her çalıştırmada şema güncellenir ve tablolar boşaltılır; localhost dışındaki adreslere izin verilmez.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!isLocalDatabaseUrl(url)) throw new Error("TEST_DATABASE_URL yerel bir PostgreSQL adresi olmalı.");
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  await db.$executeRawUnsafe('TRUNCATE "StatusHistory", "Sale", "VehiclePhoto", "Vehicle", "User" CASCADE');
  await db.$disconnect();
}
