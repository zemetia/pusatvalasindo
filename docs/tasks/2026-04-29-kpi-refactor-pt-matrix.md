# Task: KPI System Refactor — PT & Bonus Matrix Implementation

- **Date**: 2026-04-29
- **Status**: Completed
- **Source**: [Conversation b6a27e7a-4ccb-485a-957b-9aa4e14ed18e]

## 🎯 Goal

Refactor the KPI backend system to support:
1.  **Multiple Key Results (KR)** per role with specific weights.
2.  **PT-specific logic** (PVI, PTU, PKD) by introducing a `Company` (PT) table.
3.  **Bonus/Penalty Matrix** calculation via new database tables.
4.  **Daily & Monthly Calculation** focus (ignoring W1-W4 structured entry for now).

## 📋 Implementation Checklist

### Phase 1: Database Schema Refactor
- [x] **Step 1.1: Define `Company` (PT) table**
  - Add `Company` model (id, name, code, isActive).
  - Add `ptId` to `user` model to associate employees with a PT.
- [x] **Step 1.2: Enhance `RoleKpi` for Multiple KRs**
  - Add `ptId` to `RoleKpi` (FK to `Company`).
  - Add `weight` (Decimal) to `RoleKpi`.
  - Update unique constraints to `[ptId, roleName, kpiId]`.
- [x] **Step 1.3: Define Bonus Matrix Models**
  - Add `BonusMatrix` (id, ptId, roleName).
  - Add `BonusTier` (id, matrixId, minScore, maxScore, resultType, amount).
- [x] **Step 1.4: Push Schema Changes**
  - Run `npx prisma generate` and `npx prisma db push`.

### Phase 2: Seeding & Core Data
- [x] **Step 2.1: Create PT Seeder**
  - Seed "PVI", "PTU", and "PKD".
- [x] **Step 2.2: Migrate/Seed Role KPIs**
  - Update seed script to include weights and PT associations.

### Phase 3: Backend Logic (Services & Repositories)
- [x] **Step 3.1: Update Repositories**
  - Create `company.repository.ts`.
  - Update `role-kpi.repository.ts` to support PT-based queries.
  - Create `bonus-matrix.repository.ts`.
- [x] **Step 3.2: Refactor `kpiService.calculateMonthlyResult`**
  - Logic: Fetch all `RoleKpi` for employee's PT and Role.
  - Logic: Calculate weighted sum of all KR scores.
  - Logic: Lookup result in `BonusMatrix` tiers based on total score.
  - Logic: Store `bonusAmount` and `bonusResult` in `KpiMonthlyResult`.

### Phase 4: Testing & Verification
- [x] **Step 4.1: Logic Verification**
  - Verified weighted scoring and bonus matrix lookup logic in `kpi.service.ts`.
- [x] **Step 4.2: API Sync**
  - Updated RoleKpi API routes and Zod schemas to match new database structure.

## 🛠️ Technical Details

- **Files affected**:
  - `prisma/schema.prisma`
  - `backend/services/kpi.service.ts`
  - `backend/repositories/*`
  - `prisma/seed.ts`
- **New Tables**: `Company`, `BonusMatrix`, `BonusTier`.
- **Modified Tables**: `user`, `RoleKpi`, `KpiMonthlyResult`.

## 📝 Notes & Discoveries

- The user explicitly requested to focus on **daily logs** and **monthly calculations**, bypassing the W1-W4 structured entry UI for now.
- Weights must sum to 1.0 per (PT, Role) combination.
- "Top #1" bonus might need special handling (ranking across PT).
