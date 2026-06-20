# Task: Refactor Admin Form Sheets to Premium Reusable Sidebar

- **Date**: 2026-05-04
- **Status**: Completed
- **Source**: User Request

## 🎯 Goal

Create a highly premium, reusable right sidebar form component (`AdminFormSidebar`) and refactor all existing `*-sheet.tsx` components in the admin dashboard to utilize it. This standardizes the design, ensuring consistency, premium aesthetics (sticky headers/footers, glassmorphism), and maintainability across the entire admin suite.

## 📋 Implementation Checklist

- [x] **Phase 1: Component Creation**
  - [x] Step 1.1: Create `components/admin/admin-form-sidebar.tsx` with premium styling (sticky header/footer, glassmorphic effects, proper scroll areas).
- [x] **Phase 2: Component Refactoring (Batch 1)**
  - [x] Step 2.1: Refactor `create-user-sheet.tsx` & `user-sheet.tsx`.
  - [x] Step 2.2: Refactor `branch-sheet.tsx`.
  - [x] Step 2.3: Refactor `currency-sheet.tsx`.
- [x] **Phase 3: Component Refactoring (Batch 2)**
  - [x] Step 3.1: Refactor `stock-item-sheet.tsx` & `stock-mutation-sheet.tsx`.
  - [x] Step 3.2: Refactor `bank-account-sheet.tsx` & `bank-mutation-sheet.tsx`.
  - [x] Step 3.3: Refactor `kpi-definition-sheet.tsx` & `role-kpi-sheet.tsx`.
- [x] **Phase 4: Testing & Verification**
  - [x] Step 4.1: Verify styling and form submission logic remains intact.

## 🛠️ Technical Details

- **Files affected**: All `-sheet.tsx` in `components/admin/`.
- **Styling constraints**: Use Tailwind CSS, `bg-background/80`, `backdrop-blur-lg` for premium feel.

## 📝 Notes & Discoveries
