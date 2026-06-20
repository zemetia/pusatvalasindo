# Task: Complete Seeder for 3 PTs (PVI, PTU, PKD)

- **Date**: 2026-04-30
- **Status**: In Progress
- **Source**: User request to ensure seeder covers all 3 main companies.

## 🎯 Goal

Ensure all 3 PTs (Pusat Valas Indo, Pusat Tukar Uang, Pusat Kirim Duit) are fully represented in the seeder with at least one branch and initial data each.

## 📋 Implementation Checklist

- [ ] **Phase 1: Analysis**
  - [x] Verify current status: PVI and PKD have branches; PTU is missing a branch.
- [ ] **Phase 2: Implementation**
  - [ ] Add "Pluit" branch for **Pusat Tukar Uang (PTU)** in `seed.ts`.
  - [ ] Ensure PTU branch has appropriate `stockItems` and `bankAccounts`.
- [ ] **Phase 3: Execution**
  - [ ] Run `npx prisma db seed`.
  - [ ] Verify 3 companies and their branches exist in the DB.

## 🛠️ Technical Details

- **Companies**:
  - PVI (Pusat Valas Indo) -> Cengkareng, Tangerang
  - PTU (Pusat Tukar Uang) -> Pluit (New)
  - PKD (Pusat Kirim Duit) -> Pusat Kirim Duit Branch
- **Dependencies**: Prisma 7.1.0

## 📝 Notes & Discoveries

- PTU will use the standard `STOCK_ITEMS` (Currency/Gold) since "Tukar Uang" implies money changing.
