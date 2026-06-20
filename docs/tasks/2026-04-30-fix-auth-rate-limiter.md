# Task: Fix Auth Password Hash & Implement Rate Limiter

- **Date**: 2026-04-30
- **Status**: In Progress
- **Source**: User Request

## 🎯 Goal

Resolve the `Invalid password hash` Better Auth error by correctly hashing passwords during seeding, and enhance security by implementing rate limits and retry limits for authentication.

## 📋 Implementation Checklist

- [x] **Phase 1: Research & Discovery**
  - [x] Step 1.1: Identify the root cause of `Invalid password hash`.
  - [x] Step 1.2: Check `better-auth` documentation for rate limiter configuration and password hashing utilities.
- [x] **Phase 2: Core Implementation**
  - [x] Step 2.1: Update `lib/auth.ts` to include the `rateLimit` plugin.
  - [x] Step 2.2: Add a specific rate-limit window and maximum retries for `/api/auth/sign-in/email` to prevent brute force attacks.
  - [x] Step 2.3: Modify `prisma/seed.ts` to hash `password123` correctly using `better-auth` compatible hashing (or `bcryptjs`).
- [x] **Phase 3: Testing & Verification**
  - [x] Step 3.1: Reseed the database and verify the seeded accounts have a valid password hash format. (Running `npx tsx prisma/seed.ts`)
  - [x] Step 3.2: Attempt to sign in and confirm the `Invalid password hash` error is resolved.
  - [x] Step 3.3: Verify rate-limiting behavior by making multiple incorrect login attempts.

## 🛠️ Technical Details

- Files affected: `lib/auth.ts`, `prisma/seed.ts`, `package.json`
- Dependencies: `better-auth`

## 📝 Notes & Discoveries

- The `Invalid password hash` error occurs because `prisma/seed.ts` inserts plaintext `password123` into the `Account` table instead of a scrypt/bcrypt hash expected by `better-auth`.
