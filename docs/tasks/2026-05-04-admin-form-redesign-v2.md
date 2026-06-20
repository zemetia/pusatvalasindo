# Task: Ultimate Premium Redesign of Admin Form Sidebar (v2)

- **Date**: 2026-05-04
- **Status**: In Progress
- **Source**: User feedback on "too bad" design.

## 🎯 Goal

Create a "world-class" admin form experience that feels like a luxury product (Apple/Linear/Stripe quality). This is not just a redesign; it's a complete reimagining of how forms should feel in a premium dashboard.

## 📋 Implementation Checklist

- [ ] **Phase 1: Design System Overhaul**
  - [ ] Step 1.1: Define "Luxury" tokens (Deep charcoals, soft silvers, accent golds).
  - [ ] Step 1.2: Create a "Soft UI" component library (Inputs with custom depth, Buttons with spring physics).
  - [ ] Step 1.3: Plan immersive background effects (Animated mesh gradients, noise textures).

- [ ] **Phase 2: The "Immersive Panel" Redesign**
  - [ ] Step 2.1: Overhaul `AdminFormSidebar` structure.
    - [ ] Use a more integrated "Panel" feel.
    - [ ] Implement a "Focus Mode" where the background dims when the sidebar is open.
  - [ ] Step 2.2: Implement Advanced Motion.
    - [ ] Use `spring` physics for all animations.
    - [ ] Add "Focus Damping" - dim non-focused fields.
    - [ ] Implement "Entrance Sequence" - a coordinated dance of elements.

- [ ] **Phase 3: The "Soft Input" System**
  - [ ] Step 3.1: Redesign `PremiumField`.
    - [ ] Remove heavy borders; use light/shadow for definition.
    - [ ] Implement "Contextual Help" - subtle tooltips or micro-descriptions that appear on focus.
  - [ ] Step 3.2: Redesign `PremiumSelect`.
    - [ ] Create a custom select trigger that feels like a physical toggle.

- [ ] **Phase 4: Global Verification & Polish**
  - [ ] Step 4.1: Update all sheets with the "v2" design.
  - [ ] Step 4.2: Final visual audit - "The Wow Factor Test".

## 🛠️ Technical Details

- Files affected:
  - `components/admin/admin-form-sidebar.tsx`
  - `components/admin/premium-field.tsx`
  - `components/admin/user-sheet.tsx` (and others)
- Dependencies:
  - `framer-motion` (advanced usage)
  - `lucide-react`
  - `clsx`, `tailwind-merge`

## 📝 Notes & Discoveries

- The previous design was too "standard". v2 must break the standard layout patterns.
- Focus on "Depth" and "Light".
