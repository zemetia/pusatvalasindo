# Task: Seed KPI Definitions from Excel

- **Date**: 2026-05-05
- **Status**: In Progress
- **Source**: User request for KPI definition seeder from `docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx`

## 🎯 Goal

Extract KPI definitions from the "company names" sheet of the provided Excel file and create a Prisma seeder to populate the `KpiDefinition` table.

## 📋 Implementation Checklist

- [x] **Phase 1: Research & Data Extraction**
  - [x] Step 1.1: Create a scratch script `scratch/read-kpi-excel.ts` to read `docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx`.
  - [x] Step 1.2: Identify KPI names and types (EVENT/TARGET) from the "company names" sheet.
  - [x] Step 1.3: Verify the extracted data matches user expectations (manual check of output).
- [x] **Phase 2: Seeder Implementation**
  - [x] Step 2.1: Update `prisma/seeds/kpi.ts`.
  - [x] Step 2.2: Implement the `upsert` logic for `KpiDefinition`.
  - [x] Step 2.3: Integrate the new seeder into `prisma/seed.ts`.
- [x] **Phase 3: Verification**
  - [x] Step 3.1: Run the seeder using `npx prisma db seed`. (Verified `seedKpi` success)
  - [x] Step 3.2: Verify data in the database.

## 🛠️ Technical Details

- Files affected:
  - `prisma/seeds/kpi.ts` (Updated `KPI_DEFINITIONS` and commented out broken `RoleKpi` logic to follow user request of "definitions only").
- Dependencies:
  - `xlsx`
  - `prisma`

## 📝 Notes & Discoveries

- Successfully extracted 23 new KPI definitions from Excel.
- Commented out legacy `RoleKpi` seeding in `kpi.ts` to prevent schema mismatch errors and adhere to the "definitions only" request.
- Database seeder now correctly populates 27 KPI definitions.

## 🛠️ Technical Details

- Files affected:
  - `prisma/seeds/kpi-definitions.ts` (New)
  - `prisma/seed.ts` (Modified)
- Dependencies:
  - `xlsx` (already installed)
  - `prisma`

## 📝 Notes & Discoveries

- User mentioned "company names" sheet.
- User wants "just make the definition only so i can assign them manually".
- `KpiDefinition` model requires `name` and `type` (KpiType).
