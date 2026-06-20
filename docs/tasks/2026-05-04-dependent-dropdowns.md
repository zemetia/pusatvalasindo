# Task: Dependent Company-Branch Dropdowns

- **Date**: 2026-05-04
- **Status**: Completed
- **Source**: User request to add Company dropdown before Branch selection and filter branches by company.

## 🎯 Goal

Implement a "Company -> Branch" dependent dropdown logic across all administrative forms (Create User, Edit User, Stock Item, Bank Account, etc.). The Branch dropdown must be disabled until a Company is selected, and then it must only display branches associated with the selected Company.

## 📋 Implementation Checklist

### 🔍 Phase 1: Research & Discovery
- [x] **Identify All Target Forms**
    - Verified list:
        - `app/[locale]/(dashboard)/dashboard/users/page.tsx` -> `CreateUserSheet`
        - `app/[locale]/(dashboard)/dashboard/stock-items/page.tsx` -> `StockItemSheet`
        - `app/[locale]/(dashboard)/dashboard/bank-accounts/page.tsx` -> `BankAccountSheet`
        - `components/admin/user-actions.tsx` -> `UserSheet`
- [x] **Check Data Availability**
    - All pages currently fetch `branches` without `companyId`.
    - None of the pages fetch `companies`.
    - `Branch` type in sheets needs to include `companyId`.

### 🛠️ Phase 2: Core Implementation
- [x] **Step 2.1: Update Server Pages (Data Fetching)**
    - [x] Update `UsersPage`: Fetch `companies` and include `companyId` in `branches`.
    - [x] Update `StockItemsPage`: Same.
    - [x] Update `BankAccountsPage`: Same.
- [x] **Step 2.2: Update `CreateUserSheet`**
    - [x] Update `Props` to include `companies`.
    - [x] Update `Branch` type to include `companyId`.
    - [x] Add `selectedCompanyId` to local state.
    - [x] Add Company `PremiumNativeSelect`.
    - [x] Filter `branches` by `selectedCompanyId`.
    - [x] Disable Branch select if no company is selected.
- [x] **Step 2.3: Update `UserSheet`**
    - [x] Similar to Step 2.2.
- [x] **Step 2.4: Update `StockItemSheet`**
    - [x] Similar to Step 2.2.
- [x] **Step 2.5: Update `BankAccountSheet`**
    - [x] Similar to Step 2.2.

### ✅ Phase 3: Testing & Verification
- [x] **Step 3.1: Manual Verification**
    - [x] Verified User creation form dependent dropdowns.
    - [x] Verified Stock Item creation form dependent dropdowns.
    - [x] Verified Bank Account creation form dependent dropdowns.
    - [x] Verified editing forms maintain correct context.
- [x] **Step 3.2: Build Check**
    - [x] Ensured no build regressions.

## 🛠️ Technical Details

- **Files affected**: 
    - `app/[locale]/(dashboard)/dashboard/users/page.tsx`
    - `app/[locale]/(dashboard)/dashboard/stock-items/page.tsx`
    - `app/[locale]/(dashboard)/dashboard/bank-accounts/page.tsx`
    - `components/admin/user-actions.tsx`
    - `components/admin/stock-item-actions.tsx`
    - `components/admin/create-user-sheet.tsx`
    - `components/admin/user-sheet.tsx`
    - `components/admin/stock-item-sheet.tsx`
    - `components/admin/bank-account-sheet.tsx`
- **Dependencies**: Next.js, React state, existing `PremiumNativeSelect`.

## 📝 Notes & Discoveries

- [2026-05-04]: Planning initialized. Switching to Phase 1.
- [2026-05-04]: Completed all implementation phases. The "Luxury Corporate" forms now feature robust dependent dropdown logic.

