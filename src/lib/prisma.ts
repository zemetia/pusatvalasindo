import { PrismaClient } from "@src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // this app runs as a long-lived `next start` process, not serverless —
    // a single-connection pool serialized every query (including auth session
    // lookups) behind one round trip, which was the main cause of admin page slowness
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
