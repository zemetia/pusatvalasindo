# Task: Integrate Custom Roles with KPI System

- **Date**: 2026-05-04
- **Status**: In Progress
- **Source**: User request to use custom roles as "Jabatan" for KPIs

## 🎯 Goal

Link the newly created `custom_role` system to the KPI configuration, allowing administrators to define KPI targets and bonus matrices based on custom roles (Jabatan) instead of just the fixed `EmployeeRole` enum.

## 📋 Implementation Checklist

- [ ] **Phase 1: Database & Schema Refactor**
  - [ ] Step 1.1: Update `prisma/schema/kpi.prisma` to add `customRoleId` to `RoleKpi` and `BonusMatrix`.
  - [ ] Step 1.2: Make `roleName` optional in `RoleKpi` and `BonusMatrix`.
  - [ ] Step 1.3: Update `prisma/schema/auth.prisma` to add relations from `custom_role` to `RoleKpi` and `BonusMatrix`.
  - [ ] Step 1.4: Run `npx prisma db push`.
- [ ] **Phase 2: Backend Repositories & Services**
  - [ ] Step 2.1: Update `RoleKpi` repository/service to handle `customRoleId`.
  - [ ] Step 2.2: Update `BonusMatrix` repository/service to handle `customRoleId`.
- [ ] **Phase 3: UI Implementation**
  - [ ] Step 3.1: Update `components/admin/role-kpi-sheet.tsx` to:
    - [ ] Fetch `custom_role` for the selected company.
    - [ ] Allow selecting a `custom_role` as the "Jabatan".
  - [ ] Step 3.2: Update `components/admin/kpi/role-kpi-detail-sheet.tsx` (if different).
  - [ ] Step 3.3: Ensure the "Tambah Konfigurasi" flow correctly saves the `customRoleId`.
- [ ] **Phase 4: Verification**
  - [ ] Step 4.1: Verify that a KPI can be assigned to a custom role.
  - [ ] Step 4.2: Verify that KPI calculations work for users assigned to custom roles.

## 🛠️ Technical Details

- **Affected Files**:
  - `prisma/schema/kpi.prisma`
  - `prisma/schema/auth.prisma`
  - `components/admin/role-kpi-sheet.tsx`
  - `backend/repositories/role-kpi.repository.ts`
  - `backend/services/kpi.service.ts`

## 📝 Notes & Discoveries

- The user specifically mentioned "Jabatan" which maps to the Roles page I just created.
- `EmployeeRole` enum might eventually be deprecated in favor of `custom_role`.
