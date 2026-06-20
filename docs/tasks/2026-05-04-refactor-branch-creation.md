# Task: Refactor Branch Creation to Inherit Company from Active Tab

- **Date**: 2026-05-04
- **Status**: Completed
- **Source**: User Request

## 🎯 Goal

When creating a new branch (cabang), automatically infer the company from the currently active tab and hide the company selection dropdown in the form.

## 📋 Implementation Checklist

- [x] **Phase 1: State Management in BranchesPageClient**
  - [x] Add `activeTab` state to `BranchesPageClient`.
  - [x] Initialize `activeTab` with the first company's ID or "unassigned".
  - [x] Pass `activeTab` to `BranchSheet` as `currentCompanyId` for new branches.
- [x] **Phase 2: Refactor BranchSheet**
  - [x] Add `currentCompanyId` prop to `BranchSheet`.
  - [x] Initialize `form.companyId` with `currentCompanyId` if not editing.
  - [x] Hide the company `Select` dropdown when creating a new branch (`!isEdit`).
- [x] **Phase 3: Testing & Verification**
  - [x] Ensure that clicking "Tambah Cabang" on a specific company tab automatically assigns it.
  - [x] Ensure that editing an existing branch still works correctly.

## 🛠️ Technical Details

- Files affected: `components/admin/branches-page-client.tsx`, `components/admin/branch-sheet.tsx`
- Dependencies: None

## 📝 Notes & Discoveries

- We will control the `Tabs` value explicitly using `value` and `onValueChange` to keep track of `activeTab`.
