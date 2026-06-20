# Task: Redesign Admin Form Sidebar to Premium UI

- **Date**: 2026-05-04
- **Status**: In Progress
- **Source**: User request for "smooth good UI" and "redesign the form".

## 🎯 Goal

Transform the current `AdminFormSidebar` and associated form elements into a world-class, premium user interface that "wows" the user. This includes glassmorphism, smooth staggered animations, refined typography, and high-end interaction design.

## 📋 Implementation Checklist

- [x] **Phase 1: Research & Discovery**
  - [x] Step 1.1: Analyze current `AdminFormSidebar` implementation.
  - [x] Step 1.2: Identify "ugly" points: generic borders, basic inputs, static transitions, standard Shadcn look.
  - [x] Step 1.3: Define "Premium" tokens (colors, blur, shadows).

- [x] **Phase 2: Core Component Redesign**
  - [x] Step 2.1: Enhance `AdminFormSidebar` layout with Framer Motion.
    - [x] Add staggered entrance for children.
    - [x] Implement smooth slide-over transitions.
  - [x] Step 2.2: Apply Glassmorphism & Depth.
    - [x] Use `backdrop-blur-2xl`.
    - [x] Add multi-layered shadows for depth.
    - [x] Implement subtle border gradients or "shimmer" effects.
  - [x] Step 2.3: Redesign Form Elements (Inputs, Selects).
    - [x] Create a "PremiumInput" and "PremiumSelect" style.
    - [x] Add smooth focus animations and micro-interactions.

- [x] **Phase 3: Integration & Global Update**
  - [x] Step 3.1: Update `AdminFormSidebar` to support the new design patterns.
  - [x] Step 3.2: Verify visual consistency across `UserSheet`, `CreateUserSheet`, and `BranchSheet`.

- [x] **Phase 4: Testing & Verification**
  - [x] Step 4.1: Visual audit of the redesign (Self-verified).
  - [x] Step 4.2: Fix build error (duplicated imports).
  - [ ] Step 4.3: Performance check (animations should be 60fps).
  - [ ] Step 4.4: Ensure accessibility and responsive behavior.



## 🛠️ Technical Details

- Files affected:
  - `components/admin/admin-form-sidebar.tsx`
  - `components/ui/input.tsx` (maybe custom styles)
  - `components/ui/select.tsx` (maybe custom styles)
- Dependencies:
  - `framer-motion`
  - `lucide-react`
  - `clsx`, `tailwind-merge`

## 📝 Notes & Discoveries

- The user specifically hates the current design, so "playing it safe" with standard UI is not an option.
- Need to ensure the "Save" action feels rewarding (e.g., button loading state, success toast).
