# Task: Fix "Buat Pengguna Baru" Form Collisions

- **Date**: 2026-05-04
- **Status**: Research & Planning
- **Source**: User feedback regarding persistent UI collisions in /users page despite previous implementation attempts.

## 🎯 Goal

Resolve the visual collision between labels and placeholders/values in the "Buat Pengguna Baru" form, specifically for the Cabang and Jabatan dropdowns. Ensure 100% clickability and a premium, error-free UI.

## 📋 Implementation Checklist

- [ ] **Phase 1: Research & Discovery**
  - [ ] **Step 1.1: Inspect CSS Specificity**
    - Analyze if shadcn's default classes (e.g., `h-9`, `items-center`) are overriding `PremiumSelectTrigger`'s `h-full` and `pt-[28px]`.
    - Verification: Use `!important` or higher specificity selectors if needed.
  - [ ] **Step 1.2: Validate Rendering Hierarchy**
    - Confirm that `PremiumSelectTrigger` is correctly receiving the `hasIcon` context.
    - Confirm that the `PremiumSelectWrapper` height (58px) is respected by the inner trigger.
  - [ ] **Step 1.3: Audit "Buat Pengguna Baru" Component**
    - Double-check if there's any other component or a modal wrapping the sheet that might be interfering with the layout.
    - Check for any global CSS that might be affecting `SelectTrigger`.
- [ ] **Phase 2: Core Implementation (Refined)**
  - [ ] **Step 2.1: Enhance `PremiumSelectTrigger`**
    - Move to a more robust layout using `flex-col` or `items-start`.
    - Explicitly override `h-9` with `h-full !important` if necessary.
    - Refine the custom chevron positioning to avoid interference.
  - [ ] **Step 2.2: Standardize `PremiumSelectWrapper` Label**
    - Ensure the label font size (10px) is correctly applied and doesn't scale up.
    - Adjust `top` and `left` positioning for mathematical precision.
- [ ] **Phase 3: Testing & Verification**
  - [ ] Visual audit of the `/users` page "Buat Pengguna Baru" sidebar.
  - [ ] Verify clickability across the entire 58px height of each field.
  - [ ] Ensure dark mode and light mode consistency.

## 🛠️ Technical Details

- Files affected:
  - `components/admin/premium-field.tsx`
  - `components/admin/create-user-sheet.tsx`
- Dependencies: `framer-motion`, `lucide-react`, `@/components/ui/select`

## 📝 Notes & Discoveries (Analysis)

- **The Problem**: The user still sees the "collided" look. This implies that the text content of the dropdown is not being pushed down as intended by `pt-[28px]`. 
- **The Hypothesis**: Shadcn's `items-center` on the `SelectTrigger` is centering the content within the 58px container, making it overlap with the label at the top. Since `pt-[28px]` is applied to a flex container that is *also* `items-center`, the behavior might be unexpected (the "center" might be calculated after padding or the padding might be ignored if height is fixed).
- **The Solution**: Switch to `items-start` with explicit `pt` to guarantee the text starts exactly where we want it.
