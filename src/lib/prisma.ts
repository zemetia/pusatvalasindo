import { PrismaClient } from "@src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

declare global {
  var prisma: PrismaClient | undefined;
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

const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
