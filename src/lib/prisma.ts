import { statSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

declare global {
  var prisma: PrismaClient | undefined;
  var prismaGeneratedAt: number | undefined;
}

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // This app is deployed to Vercel, so each function instance is its own short-lived
    // process — NOT the long-lived `next start` server this file used to assume. Every
    // cold instance opens a fresh TCP + TLS + Postgres handshake to the remote DB, and
    // a large pool per instance multiplied across concurrent lambdas will exhaust the
    // server's `max_connections`. Keep the per-instance pool small and let PgBouncer
    // (DATABASE_URL should point at the pooler, transaction mode) do the real pooling.
    max: 3,
    // Don't hold sockets open across the idle gaps between invocations — a dead socket
    // costs a full failed round trip to discover.
    idleTimeoutMillis: 10_000,
    // Fail fast instead of hanging the whole request if the pooler is saturated.
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  // Set PRISMA_LOG_QUERIES=1 to print every SQL statement + its duration to the server console.
  // Use it to count how many round trips a page/API request actually makes and spot slow queries;
  // leave it off in normal runs (logging every query adds overhead and noise).
  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query"] : [],
  });
}

/**
 * Kapan `prisma generate` terakhir menulis client — dipakai HANYA di dev.
 *
 * Instance di bawah disimpan di `global` supaya hot-reload tidak membuka pool
 * baru tiap modul dimuat ulang. Efek sampingnya: kalau schema ditambah model
 * baru lalu client di-generate ulang SEMENTARA dev server masih hidup, proses
 * itu tetap memegang client lama seumur hidupnya. Model barunya lalu muncul
 * sebagai `prisma.modelBaru` === undefined, dan yang terlihat cuma
 * "Cannot read properties of undefined (reading 'findMany')" — pesan yang
 * tidak menyebut-nyebut sebabnya sama sekali. Membandingkan cap waktu file
 * client membuat instance basi itu dibuang sendiri saat hot-reload berikutnya.
 */
function generatedAt(): number {
  try {
    return statSync(path.join(process.cwd(), "src/generated/prisma/schema.prisma")).mtimeMs;
  } catch {
    return 0;
  }
}

const isDev = process.env.NODE_ENV !== "production";

if (isDev && global.prisma && global.prismaGeneratedAt !== generatedAt()) {
  void global.prisma.$disconnect();
  global.prisma = undefined;
}

const prisma = global.prisma ?? createPrismaClient();

if (isDev) {
  global.prisma = prisma;
  global.prismaGeneratedAt = generatedAt();
}

export default prisma;
