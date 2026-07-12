import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";

// Reuses the shared Prisma client/pool from lib/prisma.ts instead of opening a
// second connection pool — previously this created its own single-connection
// pool, which serialized session lookups against the app's own queries.
export const auth = betterAuth({
  trustedOrigins: ["*"],
  emailAndPassword: {
    enabled: true,
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60, // cache the session in a signed cookie for 60s so middleware +
      // route handlers don't each hit the DB to re-validate the same session
    },
  },
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
