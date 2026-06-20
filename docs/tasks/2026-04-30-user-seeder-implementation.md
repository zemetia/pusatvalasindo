# Task: Create User and Account Seeder

- **Date**: 2026-04-30
- **Status**: In Progress
- **Source**: User request for mock user accounts seeder.

## 🎯 Goal

Enhance the seeding process to include mock user accounts with various roles and associations to companies and branches.

## 📋 Implementation Checklist

- [x] **Phase 1: Planning**
  - [x] Define mock users and their roles (Super Admin, Owner, Kepala Cabang, Kasir, etc.).
  - [x] Identify branch and company IDs from the seeding process.
- [x] **Phase 2: Code Implementation**
  - [x] Add `seedUsers` function to `prisma/seed.ts`.
  - [x] Implement `upsert` logic for each user to prevent duplicates.
  - [x] Create corresponding `account` entries for each user (for Better-Auth).
- [x] **Phase 3: Execution & Verification**
  - [x] Run `npx prisma db seed`.
  - [x] Verify users are correctly created in the database.

## 🛠️ Technical Details

- **Users to create**:
  - Super Admin
  - Owner (PVI)
  - Kepala Cabang (Cengkareng)
  - Kasir (Cengkareng)
- **Dependencies**: Prisma 7.1.0, Better-Auth model structure.

## 📝 Notes & Discoveries

- Users must be linked to existing branches/companies.
- The `id` for users in the seeder should be deterministic if possible (e.g., using `user_` prefix).
