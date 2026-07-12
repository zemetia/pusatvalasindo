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
  return new PrismaClient({ adapter });
}

const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
