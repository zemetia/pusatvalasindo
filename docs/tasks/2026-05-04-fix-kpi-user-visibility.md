# Task: Fix User Visibility in KPI Calculate Page

- **Date**: 2026-05-04
- **Status**: In Progress
- **Source**: User request about users not showing in /calculate page

## 🎯 Goal
Ensure all eligible users (both with built-in roles and custom roles) are visible in the "Hitung KPI" page employee selection.

## 📋 Implementation Checklist

- [x] **Phase 1: Research & Discovery**
  - [x] Analyze `KpiCalculatePage` fetching logic.
  - [x] Analyze `User` model in Prisma schema.
  - [x] Check `UsersPage` and `CreateUserSheet` to understand how users are managed.
  - [x] Identify the root cause: Filter `role: { not: null }` excludes users with `customRoleId`.
- [x] **Phase 2: Core Implementation**
  - [x] Update `KpiCalculatePage` in `app/[locale]/(dashboard)/dashboard/kpi/calculate/page.tsx`:
    - [x] Update Prisma `where` clause to use `OR` for `role` and `customRoleId`.
    - [x] Include `customRole` in the Prisma query.
    - [x] Update serialization to use `customRole.name` if `role` is null.
  - [x] Update `UsersPage` in `app/[locale]/(dashboard)/dashboard/users/page.tsx`:
    - [x] Include `customRole` in the Prisma query.
    - [x] Update serialization to handle custom role names in the list.
  - [x] Update `CalculatePageClient` in `components/admin/kpi/calculate-page-client.tsx`:
    - [x] (Checked: The existing logic `ROLE_LABELS[u.role] ?? u.role` already handles custom role names correctly if passed as `u.role`).
- [ ] **Phase 3: Testing & Verification**
  - [ ] Verify that users with custom roles now appear in the dropdown.
  - [ ] Verify that built-in roles still appear and work correctly.
  - [ ] Check if `isActive` filter in client-side is still appropriate.

## 🛠️ Technical Details
- **Files affected**:
  - `app/[locale]/(dashboard)/dashboard/kpi/calculate/page.tsx`
  - `components/admin/kpi/calculate-page-client.tsx`
- **Logic Change**: 
  - Change `where: { role: { not: null } }` to `where: { OR: [{ role: { not: null } }, { customRoleId: { not: null } }] }`.

## 📝 Notes & Discoveries
- The system recently introduced custom roles, but the KPI page was still filtering only by the legacy `EmployeeRole` enum.
- Users with `customRoleId` have `role` as `null` by default in the API.
