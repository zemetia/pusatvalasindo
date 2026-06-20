# Task: Fix Admin Sidebar Form Dropdowns

- **Date**: 2026-05-04
- **Status**: In Progress
- **Source**: User request to fix "colided" dropdowns in /users page and other sidebar forms.

## 🎯 Goal

Update all admin sidebar forms to use `PremiumSelectTrigger` instead of the base `SelectTrigger` when wrapped in `PremiumSelectWrapper`. This will resolve visual collisions between labels/icons and dropdown text, and fix clickability issues.

## 📋 Implementation Checklist

- [x] **Phase 1: Research & Discovery**
  - [x] Identify all files using `PremiumSelectWrapper` without `PremiumSelectTrigger`.
  - [x] Analyze `PremiumSelectTrigger` styling in `premium-field.tsx`.
- [x] **Phase 2: Core Implementation**
  - [x] Update `components/admin/create-user-sheet.tsx`
  - [x] Update `components/admin/user-sheet.tsx`
  - [x] Update `components/admin/stock-item-sheet.tsx`
  - [x] Update `components/admin/role-kpi-sheet.tsx`
  - [x] Update `components/admin/kpi-definition-sheet.tsx`
  - [x] Update `components/admin/branch-sheet.tsx`
  - [x] Update `components/admin/bank-account-sheet.tsx`
- [ ] **Phase 3: Testing & Verification**
  - [ ] Verify `/users` "Buat Pengguna Baru" form visual layout.
  - [ ] Verify clickability of dropdowns.
  - [ ] Ensure consistent "premium" look across all updated sheets.

## 🛠️ Technical Details

- Files affected:
  - `components/admin/premium-field.tsx` (verification)
  - `components/admin/create-user-sheet.tsx`
  - `components/admin/user-sheet.tsx`
  - `components/admin/stock-item-sheet.tsx`
  - `components/admin/role-kpi-sheet.tsx`
  - `components/admin/kpi-definition-sheet.tsx`
  - `components/admin/branch-sheet.tsx`
  - `components/admin/bank-account-sheet.tsx`
- Dependencies: `lucide-react`, `framer-motion`, `@/components/ui/select`

## 📝 Notes & Discoveries

- `PremiumSelectWrapper` provides a relative container with fixed height (58px) and absolute label/icon.
- `PremiumSelectTrigger` is designed with `absolute inset-0` to fill this container and `pt-[26px]` to avoid the label.
- The current implementation in sheets uses the default `SelectTrigger` which doesn't have these absolute positionings, causing the "collision".
