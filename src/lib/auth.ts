import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg"
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  rateLimit: {
    window: 60, // 60 seconds
    max: 100, // 100 requests per 60 seconds overall
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 5, // max 5 attempts per minute for sign-in
      },
    },
  },
});
