# Task: Backend-Frontend Integration for Admin Dashboard Cabang Page

- **Date**: 2026-05-04
- **Status**: In Progress
- **Source**: User request for company-based tabs in Cabang page and ability to link branches to companies.

## 🎯 Goal

Implement a premium, smooth dashboard experience for managing branches (Cabang), organized by Company (PT) using tabs. This includes backend support for linking branches to companies and frontend UI updates for tabbed navigation and company-specific branch creation.

## 📋 Implementation Checklist

### Phase 1: Backend Updates (Database & API)
- [x] **Step 1.1: Update Branch Repository**
  - Modify `CreateBranchInput` and `UpdateBranchInput` in `backend/repositories/branch.repository.ts` to include `companyId`.
  - Update `create` and `update` methods to handle `companyId`.
- [x] **Step 1.2: Update Branch API Routes**
  - Update `createBranchSchema` in `app/api/branches/route.ts` to include `companyId`.
  - Update `updateBranchSchema` in `app/api/branches/[id]/route.ts` to include `companyId`.

### Phase 2: Frontend Infrastructure
- [x] **Step 2.1: Create `BranchesPageClient` Component**
  - Create `components/admin/branches-page-client.tsx`.
  - Implement tab logic based on `companies` prop.
  - Move the branch table logic from `app/[locale]/(dashboard)/dashboard/branches/page.tsx` to this client component.
  - Filter branches by company ID in each tab.
- [x] **Step 2.2: Update `BranchSheet` Component**
  - Add a select field for `Company`.
  - Update the form state and submission logic to include `companyId`.
  - Ensure it works for both creation and editing.
- [x] **Step 2.3: Update `BranchActions` Component**
  - Pass `companyId` to the `BranchSheet` trigger.

### Phase 3: Page Integration
- [x] **Step 3.1: Refactor `BranchesPage` (Server Component)**
  - Fetch both `branches` and `companies` from the database.
  - Pass the data to `BranchesPageClient`.
  - Ensure proper ordering (e.g., companies by name).

### Phase 4: Testing & Polish
- [x] **Step 4.1: Visual Verification**
  - Ensure tabs look premium and responsive.
  - Check "Smooth result" requirement (transitions, loading states).
- [x] **Step 4.2: Functional Verification**
  - Test creating a branch for PT A.
  - Test moving a branch from PT A to PT B.
  - Test editing branch details.
  - Test branch activation/deactivation.
- [x] **Step 4.3: Fix 404 Error**
  - Strip locale prefix from API calls in `proxy.ts` via rewrite.
  - Update matcher to recognize localized API paths.

## 🛠️ Technical Details

- **Files affected**:
  - `backend/repositories/branch.repository.ts`
  - `app/api/branches/route.ts`
  - `app/api/branches/[id]/route.ts`
  - `app/[locale]/(dashboard)/dashboard/branches/page.tsx`
  - `components/admin/branch-sheet.tsx`
  - `components/admin/branch-actions.tsx`
  - `components/admin/branches-page-client.tsx` (New)
- **Models**: `Branch`, `Company`

## 📝 Notes & Discoveries

- Companies are defined in `prisma/schema/business.prisma`.
- Branches without a company should probably be handled (maybe in an "Unassigned" or "Lainnya" tab if any exist).
- Need to ensure `companyId` is properly typed as `string | null` in the frontend and handled in the API.
